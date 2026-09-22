import { BillingCycle } from "@prisma/client";
import type { TenantClient } from "@/lib/prisma-tenant";
import { AppError } from "@/lib/errors";
import { parseVnDateInput } from "@/lib/datetime";
import { toDecimal, toNumber } from "@/lib/money";
import { findOrCreateCustomer } from "@/services/customer.service";
import { writeAudit } from "@/services/audit.service";

export async function listRooms(db: TenantClient) {
  return db.room.findMany({
    include: {
      contracts: {
        where: { deletedAt: null, status: "DANG_GUI" },
        include: { customer: true },
        take: 1,
      },
    },
    orderBy: { code: "asc" },
    take: 200,
  });
}

export async function getRoom(db: TenantClient, id: string) {
  const room = await db.room.findFirst({
    where: { id },
    include: {
      contracts: {
        where: { deletedAt: null },
        include: { customer: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!room) {
    throw new AppError("Không tìm thấy phòng.", "NOT_FOUND");
  }
  return room;
}

export async function createRoom(
  db: TenantClient,
  ctx: { tenantId: string; branchId: string; userId: string; isDemo?: boolean },
  input: {
    code: string;
    areaM2?: number;
    monthlyPrice: number;
    deposit: number;
    note?: string;
  },
) {
  const code = input.code.trim();
  if (code.length < 1) {
    throw new AppError("Nhập mã phòng.", "VALIDATION");
  }
  const dup = await db.room.findFirst({ where: { code, branchId: ctx.branchId } });
  if (dup) {
    throw new AppError("Mã phòng này đã có.", "CONFLICT");
  }
  const room = await db.room.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      code,
      areaM2: input.areaM2 != null ? toDecimal(input.areaM2) : undefined,
      monthlyPrice: toDecimal(input.monthlyPrice),
      deposit: toDecimal(input.deposit),
      note: input.note,
      status: "TRONG",
      isDemo: ctx.isDemo ?? false,
    },
  });
  await writeAudit({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "THEM_PHONG",
    entityType: "Room",
    entityId: room.id,
    after: { code },
  });
  return room;
}

export async function updateRoom(
  db: TenantClient,
  ctx: { tenantId: string; userId: string },
  id: string,
  input: {
    code: string;
    areaM2?: number;
    monthlyPrice: number;
    deposit: number;
    note?: string;
    status?: "TRONG" | "DANG_THUE" | "DANG_SUA";
  },
) {
  const room = await getRoom(db, id);
  await db.room.update({
    where: { id: room.id },
    data: {
      code: input.code.trim(),
      areaM2: input.areaM2 != null ? toDecimal(input.areaM2) : null,
      monthlyPrice: toDecimal(input.monthlyPrice),
      deposit: toDecimal(input.deposit),
      note: input.note,
      status: input.status ?? room.status,
    },
  });
}

export async function deleteRoom(db: TenantClient, ctx: { tenantId: string; userId: string }, id: string) {
  const room = await getRoom(db, id);
  await db.room.delete({ where: { id: room.id } });
  await writeAudit({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "XOA_PHONG",
    entityType: "Room",
    entityId: room.id,
  });
}

export async function rentRoom(
  db: TenantClient,
  ctx: { tenantId: string; branchId: string; userId: string; isDemo?: boolean },
  input: {
    roomId: string;
    ownerName: string;
    phone: string;
    monthlyPrice: number;
    deposit: number;
    startDate: string;
    cycle: BillingCycle;
  },
) {
  const room = await getRoom(db, input.roomId);
  const active = room.contracts.find((c) => c.status === "DANG_GUI");
  if (active) {
    throw new AppError("Phòng đang có người thuê.", "CONFLICT");
  }
  const customer = await findOrCreateCustomer(db, {
    tenantId: ctx.tenantId,
    branchId: ctx.branchId,
    name: input.ownerName,
    phone: input.phone,
    isDemo: ctx.isDemo,
  });
  const startDate = parseVnDateInput(input.startDate);
  const contract = await db.roomContract.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      roomId: room.id,
      customerId: customer.id,
      monthlyPrice: toDecimal(input.monthlyPrice),
      deposit: toDecimal(input.deposit),
      startDate,
      cycle: input.cycle,
      nextDueDate: startDate,
      status: "DANG_GUI",
      isDemo: ctx.isDemo ?? room.isDemo,
    },
  });
  await db.room.update({
    where: { id: room.id },
    data: { status: "DANG_THUE" },
  });
  return contract;
}

export async function endRoomContract(
  db: TenantClient,
  ctx: { tenantId: string; userId: string },
  roomId: string,
) {
  const room = await getRoom(db, roomId);
  const contract = room.contracts.find((c) => c.status === "DANG_GUI");
  if (!contract) {
    throw new AppError("Phòng chưa cho thuê.", "VALIDATION");
  }
  await db.roomContract.update({
    where: { id: contract.id },
    data: { status: "DA_NGHI" },
  });
  await db.room.update({
    where: { id: room.id },
    data: { status: "TRONG" },
  });
}

export async function saveUtilityAndCollect(
  db: TenantClient,
  ctx: { tenantId: string; branchId: string; userId: string },
  input: {
    roomId: string;
    periodYm: string;
    oldElectric: number;
    newElectric: number;
    oldWater: number;
    newWater: number;
    electricPrice: number;
    waterPrice: number;
    trashFee: number;
    otherFee: number;
    method: "TIEN_MAT" | "CHUYEN_KHOAN";
  },
) {
  const room = await getRoom(db, input.roomId);
  const contract = room.contracts.find((c) => c.status === "DANG_GUI");
  if (!contract) {
    throw new AppError("Phòng chưa cho thuê.", "VALIDATION");
  }
  if (input.newElectric < input.oldElectric || input.newWater < input.oldWater) {
    throw new AppError("Số mới phải lớn hơn hoặc bằng số cũ.", "VALIDATION");
  }
  const periodYm = input.periodYm.trim();
  if (!/^\d{4}-\d{2}$/.test(periodYm)) {
    throw new AppError("Nhập kỳ theo dạng 2026-09.", "VALIDATION");
  }
  const electricKwh = input.newElectric - input.oldElectric;
  const waterM3 = input.newWater - input.oldWater;
  const electricAmount = Math.round(electricKwh * input.electricPrice);
  const waterAmount = Math.round(waterM3 * input.waterPrice);
  const total = electricAmount + waterAmount + input.trashFee + input.otherFee;
  if (total <= 0) {
    throw new AppError("Tiền điện nước phải lớn hơn 0.", "VALIDATION");
  }

  const reading = await db.utilityReading.create({
    data: {
      tenantId: ctx.tenantId,
      roomContractId: contract.id,
      periodYm,
      oldElectric: toDecimal(input.oldElectric),
      newElectric: toDecimal(input.newElectric),
      oldWater: toDecimal(input.oldWater),
      newWater: toDecimal(input.newWater),
      electricPrice: toDecimal(input.electricPrice),
      waterPrice: toDecimal(input.waterPrice),
      trashFee: toDecimal(input.trashFee),
      otherFee: toDecimal(input.otherFee),
      isDemo: room.isDemo,
    },
  });

  const invoice = await db.invoice.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      customerId: contract.customerId,
      source: "PHONG_TRO",
      roomContractId: contract.id,
      utilityReadingId: reading.id,
      periodStart: contract.nextDueDate,
      periodEnd: contract.nextDueDate,
      dueDate: new Date(),
      totalAmount: toDecimal(total),
      paidAmount: toDecimal(total),
      status: "DA_THANH_TOAN",
      isDemo: room.isDemo,
    },
  });
  await db.invoiceItem.createMany({
    data: [
      {
        tenantId: ctx.tenantId,
        invoiceId: invoice.id,
        description: `Điện ${electricKwh} số`,
        amount: toDecimal(electricAmount),
        isDemo: room.isDemo,
      },
      {
        tenantId: ctx.tenantId,
        invoiceId: invoice.id,
        description: `Nước ${waterM3} khối`,
        amount: toDecimal(waterAmount),
        isDemo: room.isDemo,
      },
      {
        tenantId: ctx.tenantId,
        invoiceId: invoice.id,
        description: "Rác / khác",
        amount: toDecimal(input.trashFee + input.otherFee),
        isDemo: room.isDemo,
      },
    ],
  });
  await db.transaction.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      type: "THU",
      amount: toDecimal(total),
      occurredAt: new Date(),
      method: input.method,
      invoiceId: invoice.id,
      collectedByUserId: ctx.userId,
      note: `Điện nước phòng ${room.code} kỳ ${periodYm}`,
      isDemo: room.isDemo,
    },
  });
  return { amount: total };
}

export function roomStatusLabel(status: string) {
  if (status === "DANG_THUE") return "Đang thuê";
  if (status === "DANG_SUA") return "Đang sửa";
  return "Trống";
}

export { toNumber };
