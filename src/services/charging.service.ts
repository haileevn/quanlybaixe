import type { TenantClient } from "@/lib/prisma-tenant";
import { AppError } from "@/lib/errors";
import { nowVn, toVn } from "@/lib/datetime";
import { toDecimal, toNumber } from "@/lib/money";
import { findOrCreateCustomer } from "@/services/customer.service";
import { writeAudit } from "@/services/audit.service";

const SAFETY_HOURS = 8;

export async function listChargers(db: TenantClient) {
  return db.charger.findMany({
    include: {
      sessions: {
        where: { deletedAt: null, endedAt: null },
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { code: "asc" },
    take: 100,
  });
}

export async function listChargingPlans(db: TenantClient) {
  return db.chargingPlan.findMany({ orderBy: { name: "asc" }, take: 50 });
}

export async function createCharger(
  db: TenantClient,
  ctx: { tenantId: string; branchId: string; userId: string; isDemo?: boolean },
  input: { code: string; location?: string },
) {
  const code = input.code.trim();
  if (!code) throw new AppError("Nhập mã trụ sạc.", "VALIDATION");
  const dup = await db.charger.findFirst({ where: { code, branchId: ctx.branchId } });
  if (dup) throw new AppError("Mã trụ này đã có.", "CONFLICT");
  return db.charger.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      code,
      location: input.location,
      status: "RANH",
      isDemo: ctx.isDemo ?? false,
    },
  });
}

export async function setChargerStatus(
  db: TenantClient,
  id: string,
  status: "RANH" | "DANG_SAC" | "HONG",
) {
  const charger = await db.charger.findFirst({ where: { id } });
  if (!charger) throw new AppError("Không tìm thấy trụ sạc.", "NOT_FOUND");
  if (status === "HONG" && charger.status === "DANG_SAC") {
    throw new AppError("Trụ đang sạc. Kết thúc phiên trước.", "CONFLICT");
  }
  await db.charger.update({ where: { id: charger.id }, data: { status } });
}

export async function createChargingPlan(
  db: TenantClient,
  ctx: { tenantId: string; isDemo?: boolean },
  input: {
    name: string;
    billingType: "KWH" | "GIO" | "GOI_THANG";
    unitPrice: number;
    monthlyPrice?: number;
  },
) {
  const name = input.name.trim();
  if (name.length < 2) throw new AppError("Nhập tên gói sạc.", "VALIDATION");
  return db.chargingPlan.create({
    data: {
      tenantId: ctx.tenantId,
      name,
      billingType: input.billingType,
      unitPrice: toDecimal(input.unitPrice),
      monthlyPrice: input.monthlyPrice != null ? toDecimal(input.monthlyPrice) : undefined,
      isDemo: ctx.isDemo ?? false,
    },
  });
}

export async function startCharging(
  db: TenantClient,
  ctx: { tenantId: string; branchId: string; userId: string },
  input: {
    chargerId: string;
    chargingPlanId?: string;
    ownerName?: string;
    phone?: string;
  },
) {
  const charger = await db.charger.findFirst({ where: { id: input.chargerId } });
  if (!charger) throw new AppError("Không tìm thấy trụ sạc.", "NOT_FOUND");
  if (charger.status !== "RANH") {
    throw new AppError("Trụ này chưa rảnh.", "CONFLICT");
  }
  let customerId: string | undefined;
  if (input.ownerName && input.phone) {
    const customer = await findOrCreateCustomer(db, {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      name: input.ownerName,
      phone: input.phone,
    });
    customerId = customer.id;
  }
  const session = await db.chargingSession.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      chargerId: charger.id,
      customerId,
      chargingPlanId: input.chargingPlanId || undefined,
      startedAt: new Date(),
      isDemo: charger.isDemo,
    },
  });
  await db.charger.update({
    where: { id: charger.id },
    data: { status: "DANG_SAC" },
  });
  await writeAudit({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "BAT_DAU_SAC",
    entityType: "ChargingSession",
    entityId: session.id,
    after: { charger: charger.code },
  });
  return session;
}

export async function stopCharging(
  db: TenantClient,
  ctx: { tenantId: string; branchId: string; userId: string },
  input: { chargerId: string; kwh?: number; method: "TIEN_MAT" | "CHUYEN_KHOAN" },
) {
  const charger = await db.charger.findFirst({ where: { id: input.chargerId } });
  if (!charger) throw new AppError("Không tìm thấy trụ sạc.", "NOT_FOUND");
  const session = await db.chargingSession.findFirst({
    where: { chargerId: charger.id, endedAt: null },
    include: { chargingPlan: true, customer: true },
  });
  if (!session) throw new AppError("Không có phiên sạc đang chạy.", "NOT_FOUND");

  const endedAt = new Date();
  const hours = Math.max(nowVn().diff(toVn(session.startedAt), "hour", true), 0.1);
  const plan = session.chargingPlan;
  let amount = 0;
  if (plan?.billingType === "KWH") {
    const kwh = input.kwh ?? 0;
    if (kwh <= 0) throw new AppError("Nhập số kWh đã sạc.", "VALIDATION");
    amount = Math.round(kwh * toNumber(plan.unitPrice));
  } else if (plan?.billingType === "GIO") {
    amount = Math.round(hours * toNumber(plan.unitPrice));
  } else if (plan?.billingType === "GOI_THANG") {
    amount = 0;
  } else {
    amount = Math.round(hours * 10000);
  }
  const safetyWarning = hours >= SAFETY_HOURS;

  await db.chargingSession.update({
    where: { id: session.id },
    data: {
      endedAt,
      kwh: input.kwh != null ? toDecimal(input.kwh) : undefined,
      amount: toDecimal(amount),
      safetyWarning,
    },
  });
  await db.charger.update({
    where: { id: charger.id },
    data: { status: "RANH" },
  });

  if (amount > 0) {
    const customerId = session.customerId;
    if (!customerId) {
      throw new AppError("Phiên sạc thu tiền cần tên và SĐT khách.", "VALIDATION");
    }
    const invoice = await db.invoice.create({
      data: {
        tenantId: ctx.tenantId,
        branchId: ctx.branchId,
        customerId,
        source: "SAC_DIEN",
        chargingSessionId: session.id,
        periodStart: session.startedAt,
        periodEnd: endedAt,
        dueDate: endedAt,
        totalAmount: toDecimal(amount),
        paidAmount: toDecimal(amount),
        status: "DA_THANH_TOAN",
        isDemo: charger.isDemo,
      },
    });
    await db.invoiceItem.create({
      data: {
        tenantId: ctx.tenantId,
        invoiceId: invoice.id,
        description: `Sạc trụ ${charger.code}`,
        amount: toDecimal(amount),
        isDemo: charger.isDemo,
      },
    });
    await db.transaction.create({
      data: {
        tenantId: ctx.tenantId,
        branchId: ctx.branchId,
        type: "THU",
        amount: toDecimal(amount),
        occurredAt: endedAt,
        method: input.method,
        invoiceId: invoice.id,
        collectedByUserId: ctx.userId,
        note: `Sạc ${charger.code}`,
        isDemo: charger.isDemo,
      },
    });
  }

  return { amount, hours, safetyWarning };
}

export function chargerStatusLabel(status: string) {
  if (status === "DANG_SAC") return "Đang sạc";
  if (status === "HONG") return "Hỏng";
  return "Rảnh";
}
