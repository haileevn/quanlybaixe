import { ServiceCycle } from "@prisma/client";
import type { TenantClient } from "@/lib/prisma-tenant";
import { AppError } from "@/lib/errors";
import { parseVnDateInput } from "@/lib/datetime";
import { toDecimal } from "@/lib/money";
import { findOrCreateCustomer } from "@/services/customer.service";
import { writeAudit } from "@/services/audit.service";

export async function listServiceTypes(db: TenantClient) {
  return db.serviceType.findMany({ orderBy: { name: "asc" }, take: 100 });
}

export async function listServiceSubs(db: TenantClient) {
  return db.serviceSubscription.findMany({
    where: { status: "DANG_GUI" },
    include: { customer: true, serviceType: true },
    orderBy: { nextDueDate: "asc" },
    take: 200,
  });
}

export async function createServiceType(
  db: TenantClient,
  ctx: { tenantId: string; userId: string; isDemo?: boolean },
  input: { name: string; unitPrice: number; unit: string; cycle: ServiceCycle },
) {
  const name = input.name.trim();
  if (name.length < 2) throw new AppError("Nhập tên dịch vụ.", "VALIDATION");
  const row = await db.serviceType.create({
    data: {
      tenantId: ctx.tenantId,
      name,
      unitPrice: toDecimal(input.unitPrice),
      unit: input.unit.trim() || "lần",
      cycle: input.cycle,
      isDemo: ctx.isDemo ?? false,
    },
  });
  await writeAudit({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "THEM_DICH_VU",
    entityType: "ServiceType",
    entityId: row.id,
    after: { name },
  });
  return row;
}

export async function deleteServiceType(db: TenantClient, id: string) {
  const row = await db.serviceType.findFirst({ where: { id } });
  if (!row) throw new AppError("Không tìm thấy dịch vụ.", "NOT_FOUND");
  await db.serviceType.delete({ where: { id: row.id } });
}

export async function subscribeService(
  db: TenantClient,
  ctx: { tenantId: string; branchId: string; userId: string; isDemo?: boolean },
  input: {
    serviceTypeId: string;
    ownerName: string;
    phone: string;
    price: number;
    startDate: string;
  },
) {
  const type = await db.serviceType.findFirst({ where: { id: input.serviceTypeId } });
  if (!type) throw new AppError("Không tìm thấy loại dịch vụ.", "NOT_FOUND");
  const customer = await findOrCreateCustomer(db, {
    tenantId: ctx.tenantId,
    branchId: ctx.branchId,
    name: input.ownerName,
    phone: input.phone,
    isDemo: ctx.isDemo,
  });
  const startDate = parseVnDateInput(input.startDate);
  return db.serviceSubscription.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      serviceTypeId: type.id,
      customerId: customer.id,
      price: toDecimal(input.price),
      startDate,
      nextDueDate: type.cycle === "THANG" ? startDate : null,
      status: "DANG_GUI",
      isDemo: ctx.isDemo ?? type.isDemo,
    },
  });
}

export async function getServiceSub(db: TenantClient, id: string) {
  const row = await db.serviceSubscription.findFirst({
    where: { id },
    include: { customer: true, serviceType: true },
  });
  if (!row) throw new AppError("Không tìm thấy đăng ký dịch vụ.", "NOT_FOUND");
  return row;
}
