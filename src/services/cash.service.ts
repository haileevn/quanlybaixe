import { PaymentMethod, Prisma, TransactionType } from "@prisma/client";
import type { TenantClient } from "@/lib/prisma-tenant";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { toDecimal, toNumber } from "@/lib/money";
import { vnDateToUtc, vnEndOfDay, vnStartOfDay } from "@/lib/datetime";
import { writeAudit } from "@/services/audit.service";

export const DEFAULT_EXPENSE_NAMES = [
  "Điện",
  "Nước",
  "Lương nhân viên",
  "Thuê mặt bằng gốc",
  "Sửa chữa",
  "Thuế",
  "Khác",
];

export async function ensureExpenseCategories(tenantId: string) {
  const count = await prisma.expenseCategory.count({
    where: { tenantId, deletedAt: null },
  });
  if (count > 0) {
    return;
  }
  await prisma.expenseCategory.createMany({
    data: DEFAULT_EXPENSE_NAMES.map((name) => ({ tenantId, name })),
  });
}

export async function listExpenseCategories(db: TenantClient) {
  return db.expenseCategory.findMany({ orderBy: { name: "asc" } });
}

export async function createExpenseCategory(db: TenantClient, tenantId: string, name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    throw new AppError("Nhập tên khoản chi.", "VALIDATION");
  }
  return db.expenseCategory.create({ data: { tenantId, name: trimmed } });
}

export async function recordWalkInIncome(
  db: TenantClient,
  ctx: { tenantId: string; branchId: string; userId: string },
  input: { amount: number; method: PaymentMethod; note?: string; imageUrl?: string; occurredOn?: string },
) {
  if (input.amount <= 0) {
    throw new AppError("Số tiền phải lớn hơn 0.", "VALIDATION");
  }
  const occurredAt = input.occurredOn ? vnDateToUtc(input.occurredOn) : new Date();
  const row = await db.transaction.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      type: "THU",
      amount: toDecimal(input.amount),
      occurredAt,
      method: input.method,
      collectedByUserId: ctx.userId,
      note: input.note,
      imageUrl: input.imageUrl,
    },
  });
  await writeAudit({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "THU_VANG_LAI",
    entityType: "Transaction",
    entityId: row.id,
    after: { amount: input.amount, note: input.note ?? "" },
  });
  return row;
}

export async function recordExpense(
  db: TenantClient,
  ctx: { tenantId: string; branchId: string; userId: string },
  input: {
    amount: number;
    method: PaymentMethod;
    expenseCategoryId: string;
    note?: string;
    imageUrl?: string;
    occurredOn?: string;
  },
) {
  if (input.amount <= 0) {
    throw new AppError("Số tiền phải lớn hơn 0.", "VALIDATION");
  }
  const category = await db.expenseCategory.findFirst({
    where: { id: input.expenseCategoryId },
  });
  if (!category) {
    throw new AppError("Không tìm thấy khoản chi.", "NOT_FOUND");
  }
  const occurredAt = input.occurredOn ? vnDateToUtc(input.occurredOn) : new Date();
  const row = await db.transaction.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      type: "CHI",
      amount: toDecimal(input.amount),
      occurredAt,
      method: input.method,
      expenseCategoryId: input.expenseCategoryId,
      collectedByUserId: ctx.userId,
      note: input.note,
      imageUrl: input.imageUrl,
    },
  });
  await writeAudit({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "GHI_CHI",
    entityType: "Transaction",
    entityId: row.id,
    after: { amount: input.amount, category: category.name },
  });
  return row;
}

export async function listTransactions(
  db: TenantClient,
  input: { type?: TransactionType; from: Date; to: Date },
) {
  return db.transaction.findMany({
    where: {
      occurredAt: { gte: input.from, lte: input.to },
      ...(input.type ? { type: input.type } : {}),
    },
    include: { expenseCategory: true, collectedBy: true },
    orderBy: { occurredAt: "desc" },
    take: 200,
  });
}

export async function sumByType(db: TenantClient, type: TransactionType, from: Date, to: Date) {
  const rows = await db.transaction.findMany({
    where: { type, occurredAt: { gte: from, lte: to } },
    select: { amount: true },
  });
  return rows.reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0));
}

export async function getCashbookView(db: TenantClient, tenantId: string, branchId: string, day?: Date) {
  const start = vnStartOfDay(day);
  const end = vnEndOfDay(day);
  const totalIn = await sumByType(db, "THU", start.toDate(), end.toDate());
  const totalOut = await sumByType(db, "CHI", start.toDate(), end.toDate());
  const lastClose = await prisma.cashbookClosing.findFirst({
    where: {
      tenantId,
      branchId,
      deletedAt: null,
      closedOn: { lt: start.toDate() },
    },
    orderBy: { closedOn: "desc" },
  });
  const opening = lastClose?.closingBalance ?? new Prisma.Decimal(0);
  const closing = opening.add(totalIn).sub(totalOut);
  const todayClose = await prisma.cashbookClosing.findFirst({
    where: {
      tenantId,
      branchId,
      deletedAt: null,
      closedOn: start.toDate(),
    },
  });
  return {
    day: start.toDate(),
    opening: toNumber(opening),
    totalIn: toNumber(totalIn),
    totalOut: toNumber(totalOut),
    closing: toNumber(closing),
    closed: Boolean(todayClose),
  };
}

export async function closeCashbook(
  db: TenantClient,
  ctx: { tenantId: string; branchId: string; userId: string },
  note?: string,
) {
  const view = await getCashbookView(db, ctx.tenantId, ctx.branchId);
  if (view.closed) {
    throw new AppError("Hôm nay đã chốt sổ rồi.", "CONFLICT");
  }
  const row = await db.cashbookClosing.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      closedOn: view.day,
      openingBalance: toDecimal(view.opening),
      totalIn: toDecimal(view.totalIn),
      totalOut: toDecimal(view.totalOut),
      closingBalance: toDecimal(view.closing),
      note,
    },
  });
  await writeAudit({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "CHOT_SO",
    entityType: "CashbookClosing",
    entityId: row.id,
    after: { closing: view.closing },
  });
  return view;
}
