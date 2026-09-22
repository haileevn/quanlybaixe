import { BillingCycle } from "@prisma/client";
import type { TenantClient } from "@/lib/prisma-tenant";
import { AppError } from "@/lib/errors";
import { parseVnDateInput } from "@/lib/datetime";
import { toDecimal } from "@/lib/money";
import { findOrCreateCustomer } from "@/services/customer.service";
import { writeAudit } from "@/services/audit.service";

export async function listKiosks(db: TenantClient) {
  return db.kiosk.findMany({
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

export async function getKiosk(db: TenantClient, id: string) {
  const kiosk = await db.kiosk.findFirst({
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
  if (!kiosk) {
    throw new AppError("Không tìm thấy mặt bằng.", "NOT_FOUND");
  }
  return kiosk;
}

export async function createKiosk(
  db: TenantClient,
  ctx: { tenantId: string; branchId: string; userId: string; isDemo?: boolean },
  input: { code: string; location?: string; areaM2?: number; monthlyPrice: number },
) {
  const code = input.code.trim();
  if (!code) throw new AppError("Nhập mã ô / ki-ốt.", "VALIDATION");
  const dup = await db.kiosk.findFirst({ where: { code, branchId: ctx.branchId } });
  if (dup) throw new AppError("Mã ô này đã có.", "CONFLICT");
  const row = await db.kiosk.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      code,
      location: input.location,
      areaM2: input.areaM2 != null ? toDecimal(input.areaM2) : undefined,
      monthlyPrice: toDecimal(input.monthlyPrice),
      isDemo: ctx.isDemo ?? false,
    },
  });
  await writeAudit({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "THEM_MAT_BANG",
    entityType: "Kiosk",
    entityId: row.id,
    after: { code },
  });
  return row;
}

export async function updateKiosk(
  db: TenantClient,
  id: string,
  input: { code: string; location?: string; areaM2?: number; monthlyPrice: number },
) {
  const kiosk = await getKiosk(db, id);
  await db.kiosk.update({
    where: { id: kiosk.id },
    data: {
      code: input.code.trim(),
      location: input.location,
      areaM2: input.areaM2 != null ? toDecimal(input.areaM2) : null,
      monthlyPrice: toDecimal(input.monthlyPrice),
    },
  });
}

export async function deleteKiosk(db: TenantClient, ctx: { tenantId: string; userId: string }, id: string) {
  const kiosk = await getKiosk(db, id);
  await db.kiosk.delete({ where: { id: kiosk.id } });
  await writeAudit({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "XOA_MAT_BANG",
    entityType: "Kiosk",
    entityId: kiosk.id,
  });
}

export async function rentKiosk(
  db: TenantClient,
  ctx: { tenantId: string; branchId: string; userId: string; isDemo?: boolean },
  input: {
    kioskId: string;
    ownerName: string;
    phone: string;
    businessType?: string;
    monthlyPrice: number;
    deposit: number;
    startDate: string;
    cycle: BillingCycle;
  },
) {
  const kiosk = await getKiosk(db, input.kioskId);
  if (kiosk.contracts.some((c) => c.status === "DANG_GUI")) {
    throw new AppError("Ô này đang cho thuê.", "CONFLICT");
  }
  const customer = await findOrCreateCustomer(db, {
    tenantId: ctx.tenantId,
    branchId: ctx.branchId,
    name: input.ownerName,
    phone: input.phone,
    isDemo: ctx.isDemo,
  });
  const startDate = parseVnDateInput(input.startDate);
  return db.kioskContract.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      kioskId: kiosk.id,
      customerId: customer.id,
      businessType: input.businessType,
      monthlyPrice: toDecimal(input.monthlyPrice),
      deposit: toDecimal(input.deposit),
      startDate,
      cycle: input.cycle,
      nextDueDate: startDate,
      status: "DANG_GUI",
      isDemo: ctx.isDemo ?? kiosk.isDemo,
    },
  });
}

export async function endKioskContract(db: TenantClient, kioskId: string) {
  const kiosk = await getKiosk(db, kioskId);
  const contract = kiosk.contracts.find((c) => c.status === "DANG_GUI");
  if (!contract) throw new AppError("Ô chưa cho thuê.", "VALIDATION");
  await db.kioskContract.update({
    where: { id: contract.id },
    data: { status: "DA_NGHI" },
  });
}
