import { PaymentMethod, Prisma } from "@prisma/client";
import type { TenantClient } from "@/lib/prisma-tenant";
import { AppError } from "@/lib/errors";
import { addBillingCycle, addBillingMonths, vnStartOfDay } from "@/lib/datetime";
import { toNumber } from "@/lib/money";
import { writeAudit } from "@/services/audit.service";
import { getVehicle } from "@/services/vehicle.service";
import { getRoom } from "@/services/room.service";
import { getKiosk } from "@/services/kiosk.service";
import { getServiceSub } from "@/services/extra.service";

export async function collectVehiclePayment(
  db: TenantClient,
  ctx: { tenantId: string; branchId: string; userId: string },
  input: { vehicleId: string; method: PaymentMethod; note?: string; months?: number; imageUrl?: string },
) {
  const vehicle = await getVehicle(db, input.vehicleId);
  const contract = vehicle.contracts[0];
  if (!contract) {
    throw new AppError("Xe chưa có hợp đồng gửi tháng.", "VALIDATION");
  }
  if (contract.status !== "DANG_GUI") {
    throw new AppError("Xe đang tạm ngưng hoặc đã nghỉ, không thu tháng.", "VALIDATION");
  }

  const months = input.months && input.months >= 3 ? 3 : 1;
  const periodStart = contract.nextDueDate;
  const periodEnd = addBillingMonths(periodStart, contract.cycle, months);
  const amount = new Prisma.Decimal(toNumber(contract.monthlyPrice) * months);

  const invoice = await db.invoice.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      customerId: vehicle.customerId,
      source: "XE_THANG",
      vehicleContractId: contract.id,
      periodStart,
      periodEnd,
      dueDate: periodStart,
      totalAmount: amount,
      paidAmount: amount,
      status: "DA_THANH_TOAN",
      note: input.note,
      isDemo: vehicle.isDemo,
    },
  });

  await db.invoiceItem.create({
    data: {
      tenantId: ctx.tenantId,
      invoiceId: invoice.id,
      description: months > 1 ? `Gửi xe ${months} tháng ${vehicle.plateNumber}` : `Gửi xe tháng ${vehicle.plateNumber}`,
      amount,
      isDemo: vehicle.isDemo,
    },
  });

  const transaction = await db.transaction.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      type: "THU",
      amount,
      occurredAt: new Date(),
      method: input.method,
      invoiceId: invoice.id,
      collectedByUserId: ctx.userId,
      note: input.note,
      imageUrl: input.imageUrl,
      isDemo: vehicle.isDemo,
    },
  });

  await db.vehicleContract.update({
    where: { id: contract.id },
    data: { nextDueDate: periodEnd },
  });

  await writeAudit({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "THU_TIEN_XE_THANG",
    entityType: "Transaction",
    entityId: transaction.id,
    after: {
      plateNumber: vehicle.plateNumber,
      amount: toNumber(amount),
      method: input.method,
      months,
    },
  });

  return {
    amount: toNumber(amount),
    nextDueDate: periodEnd,
    invoiceId: invoice.id,
    receiptToken: invoice.receiptToken,
  };
}

export async function collectRoomPayment(
  db: TenantClient,
  ctx: { tenantId: string; branchId: string; userId: string },
  input: { roomId: string; method: PaymentMethod; note?: string; months?: number; imageUrl?: string },
) {
  const room = await getRoom(db, input.roomId);
  const contract = room.contracts.find((c) => c.status === "DANG_GUI") ?? room.contracts[0];
  if (!contract || contract.status !== "DANG_GUI") {
    throw new AppError("Phòng chưa cho thuê.", "VALIDATION");
  }
  const months = input.months && input.months >= 3 ? 3 : 1;
  const periodStart = contract.nextDueDate;
  const periodEnd = addBillingMonths(periodStart, contract.cycle, months);
  const amount = new Prisma.Decimal(toNumber(contract.monthlyPrice) * months);
  const invoice = await db.invoice.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      customerId: contract.customerId,
      source: "PHONG_TRO",
      roomContractId: contract.id,
      periodStart,
      periodEnd,
      dueDate: periodStart,
      totalAmount: amount,
      paidAmount: amount,
      status: "DA_THANH_TOAN",
      note: input.note,
      isDemo: room.isDemo,
    },
  });
  await db.invoiceItem.create({
    data: {
      tenantId: ctx.tenantId,
      invoiceId: invoice.id,
      description: `Tiền phòng ${room.code}`,
      amount,
      isDemo: room.isDemo,
    },
  });
  await db.transaction.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      type: "THU",
      amount,
      occurredAt: new Date(),
      method: input.method,
      invoiceId: invoice.id,
      collectedByUserId: ctx.userId,
      note: input.note,
      imageUrl: input.imageUrl,
      isDemo: room.isDemo,
    },
  });
  await db.roomContract.update({
    where: { id: contract.id },
    data: { nextDueDate: periodEnd },
  });
  return { amount: toNumber(amount), nextDueDate: periodEnd, invoiceId: invoice.id, receiptToken: invoice.receiptToken };
}

export async function collectKioskPayment(
  db: TenantClient,
  ctx: { tenantId: string; branchId: string; userId: string },
  input: { kioskId: string; method: PaymentMethod; note?: string; months?: number; imageUrl?: string },
) {
  const kiosk = await getKiosk(db, input.kioskId);
  const contract = kiosk.contracts.find((c) => c.status === "DANG_GUI") ?? kiosk.contracts[0];
  if (!contract || contract.status !== "DANG_GUI") {
    throw new AppError("Ô chưa cho thuê.", "VALIDATION");
  }
  const months = input.months && input.months >= 3 ? 3 : 1;
  const periodStart = contract.nextDueDate;
  const periodEnd = addBillingMonths(periodStart, contract.cycle, months);
  const amount = new Prisma.Decimal(toNumber(contract.monthlyPrice) * months);
  const invoice = await db.invoice.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      customerId: contract.customerId,
      source: "MAT_BANG",
      kioskContractId: contract.id,
      periodStart,
      periodEnd,
      dueDate: periodStart,
      totalAmount: amount,
      paidAmount: amount,
      status: "DA_THANH_TOAN",
      note: input.note,
      isDemo: kiosk.isDemo,
    },
  });
  await db.invoiceItem.create({
    data: {
      tenantId: ctx.tenantId,
      invoiceId: invoice.id,
      description: `Thuê mặt bằng ${kiosk.code}`,
      amount,
      isDemo: kiosk.isDemo,
    },
  });
  await db.transaction.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      type: "THU",
      amount,
      occurredAt: new Date(),
      method: input.method,
      invoiceId: invoice.id,
      collectedByUserId: ctx.userId,
      note: input.note,
      imageUrl: input.imageUrl,
      isDemo: kiosk.isDemo,
    },
  });
  await db.kioskContract.update({
    where: { id: contract.id },
    data: { nextDueDate: periodEnd },
  });
  return { amount: toNumber(amount), nextDueDate: periodEnd, invoiceId: invoice.id, receiptToken: invoice.receiptToken };
}

export async function collectServicePayment(
  db: TenantClient,
  ctx: { tenantId: string; branchId: string; userId: string },
  input: { subscriptionId: string; method: PaymentMethod; note?: string; imageUrl?: string },
) {
  const sub = await getServiceSub(db, input.subscriptionId);
  if (sub.status !== "DANG_GUI") {
    throw new AppError("Dịch vụ đã ngưng.", "VALIDATION");
  }
  const periodStart = sub.nextDueDate ?? sub.startDate;
  const periodEnd =
    sub.serviceType.cycle === "THANG" ? addBillingCycle(periodStart, "THANG") : periodStart;
  const amount = sub.price;
  const invoice = await db.invoice.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      customerId: sub.customerId,
      source: "DICH_VU",
      serviceSubscriptionId: sub.id,
      periodStart,
      periodEnd,
      dueDate: periodStart,
      totalAmount: amount,
      paidAmount: amount,
      status: "DA_THANH_TOAN",
      note: input.note,
      isDemo: sub.isDemo,
    },
  });
  await db.invoiceItem.create({
    data: {
      tenantId: ctx.tenantId,
      invoiceId: invoice.id,
      description: sub.serviceType.name,
      amount,
      isDemo: sub.isDemo,
    },
  });
  await db.transaction.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      type: "THU",
      amount,
      occurredAt: new Date(),
      method: input.method,
      invoiceId: invoice.id,
      collectedByUserId: ctx.userId,
      note: input.note,
      imageUrl: input.imageUrl,
      isDemo: sub.isDemo,
    },
  });
  if (sub.serviceType.cycle === "THANG") {
    await db.serviceSubscription.update({
      where: { id: sub.id },
      data: { nextDueDate: periodEnd },
    });
  } else {
    await db.serviceSubscription.update({
      where: { id: sub.id },
      data: { status: "DA_NGHI", nextDueDate: null },
    });
  }
  return { amount: toNumber(amount), nextDueDate: periodEnd, invoiceId: invoice.id, receiptToken: invoice.receiptToken };
}

export async function listVehiclePayments(db: TenantClient, vehicleId: string) {
  const vehicle = await getVehicle(db, vehicleId);
  const contract = vehicle.contracts[0];
  if (!contract) {
    return [];
  }
  return db.invoice.findMany({
    where: { vehicleContractId: contract.id, status: "DA_THANH_TOAN" },
    include: { transactions: true },
    orderBy: { dueDate: "desc" },
    take: 24,
  });
}

export async function sumTodayIncome(db: TenantClient) {
  const start = vnStartOfDay().toDate();
  const end = vnStartOfDay().endOf("day").toDate();
  const rows = await db.transaction.findMany({
    where: {
      type: "THU",
      occurredAt: { gte: start, lte: end },
    },
    select: { amount: true },
  });
  return rows.reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0));
}
