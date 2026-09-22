import { BillingCycle, ContractStatus, Prisma, VehicleType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TenantClient } from "@/lib/prisma-tenant";
import { AppError } from "@/lib/errors";
import { addBillingCycle, parseVnDateInput, vnStartOfDay } from "@/lib/datetime";
import { toDecimal } from "@/lib/money";
import { normalizePlate, plateSearchKey } from "@/lib/plate";
import { assertVehicleLimit, remainingVehicleSlots } from "@/services/plan.service";
import { findOrCreateCustomer } from "@/services/customer.service";
import { writeAudit } from "@/services/audit.service";

export type VehicleInput = {
  plateNumber: string;
  vehicleType: VehicleType;
  ownerName: string;
  phone: string;
  roomOrAddress?: string;
  note?: string;
  monthlyPrice: number;
  startDate: string;
  cycle: BillingCycle;
  status?: ContractStatus;
  imageUrl?: string;
};

export async function listVehicles(
  db: TenantClient,
  input: { search?: string; take?: number },
) {
  const search = input.search?.trim() ?? "";
  const digits = plateSearchKey(search);
  const where: Prisma.VehicleWhereInput = {};
  if (digits.length >= 3) {
    where.plateSearch = { endsWith: digits.slice(-3) };
  } else if (search.length >= 2) {
    where.OR = [
      { plateNumber: { contains: search } },
      { customer: { name: { contains: search } } },
      { customer: { phone: { contains: search } } },
    ];
  }
  return db.vehicle.findMany({
    where,
    include: {
      customer: true,
      contracts: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: input.take ?? 80,
  });
}

export async function getVehicle(db: TenantClient, id: string) {
  const vehicle = await db.vehicle.findFirst({
    where: { id },
    include: {
      customer: true,
      contracts: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!vehicle) {
    throw new AppError("Không tìm thấy xe.", "NOT_FOUND");
  }
  return vehicle;
}

export async function findVehicleByPlateDetailed(db: TenantClient, plateInput: string) {
  const norm = normalizePlate(plateInput);
  const searchKey = plateSearchKey(plateInput);

  // Tìm theo biển số chuẩn hoá hoặc mã số biển
  const vehicle = await db.vehicle.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { plateNumber: norm },
        { plateNumber: plateInput.trim() },
        ...(searchKey.length >= 4 ? [{ plateSearch: searchKey }] : []),
      ],
    },
    include: {
      customer: true,
      contracts: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return vehicle;
}

export async function createVehicle(
  db: TenantClient,
  ctx: { tenantId: string; branchId: string; userId: string; isDemo?: boolean },
  input: VehicleInput,
) {
  if (!ctx.isDemo) {
    await assertVehicleLimit(ctx.tenantId);
  }
  const plateNumber = normalizePlate(input.plateNumber);
  const duplicate = await db.vehicle.findFirst({
    where: { plateNumber, branchId: ctx.branchId },
  });
  if (duplicate) {
    throw new AppError("Biển số này đã có trong bãi.", "CONFLICT");
  }

  const customer = await findOrCreateCustomer(db, {
    tenantId: ctx.tenantId,
    branchId: ctx.branchId,
    name: input.ownerName,
    phone: input.phone,
    address: input.roomOrAddress,
    isDemo: ctx.isDemo,
  });

  const startDate = parseVnDateInput(input.startDate);
  const vehicle = await db.vehicle.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      customerId: customer.id,
      plateNumber,
      plateSearch: plateSearchKey(plateNumber),
      vehicleType: input.vehicleType,
      imageUrl: input.imageUrl,
      roomOrAddress: input.roomOrAddress,
      note: input.note,
      isDemo: ctx.isDemo ?? false,
    },
  });

  await db.vehicleContract.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      vehicleId: vehicle.id,
      monthlyPrice: toDecimal(input.monthlyPrice),
      startDate,
      cycle: input.cycle,
      nextDueDate: startDate,
      status: input.status ?? "DANG_GUI",
      isDemo: ctx.isDemo ?? false,
    },
  });

  await writeAudit({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "TAO_XE",
    entityType: "Vehicle",
    entityId: vehicle.id,
    after: { plateNumber, monthlyPrice: input.monthlyPrice },
  });

  return vehicle;
}

export async function updateVehicle(
  db: TenantClient,
  ctx: { tenantId: string; branchId: string; userId: string; canEditPrice: boolean },
  id: string,
  input: VehicleInput,
) {
  const current = await getVehicle(db, id);
  const plateNumber = normalizePlate(input.plateNumber);
  const duplicate = await db.vehicle.findFirst({
    where: { plateNumber, branchId: ctx.branchId, id: { not: id } },
  });
  if (duplicate) {
    throw new AppError("Biển số này đã có trong bãi.", "CONFLICT");
  }

  const customer = await findOrCreateCustomer(db, {
    tenantId: ctx.tenantId,
    branchId: ctx.branchId,
    name: input.ownerName,
    phone: input.phone,
    address: input.roomOrAddress,
  });

  await db.vehicle.update({
    where: { id },
    data: {
      customerId: customer.id,
      plateNumber,
      plateSearch: plateSearchKey(plateNumber),
      vehicleType: input.vehicleType,
      imageUrl: input.imageUrl || current.imageUrl,
      roomOrAddress: input.roomOrAddress,
      note: input.note,
    },
  });

  const contract = current.contracts[0];
  if (contract) {
    const startDate = parseVnDateInput(input.startDate);
    await db.vehicleContract.update({
      where: { id: contract.id },
      data: {
        startDate,
        cycle: input.cycle,
        status: input.status ?? contract.status,
        monthlyPrice: ctx.canEditPrice ? toDecimal(input.monthlyPrice) : contract.monthlyPrice,
      },
    });
  }

  await writeAudit({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "SUA_XE",
    entityType: "Vehicle",
    entityId: id,
    before: { plate: current.plateNumber },
    after: { plate: plateNumber },
  });
}

export async function softDeleteVehicle(
  db: TenantClient,
  ctx: { tenantId: string; userId: string },
  id: string,
) {
  const vehicle = await getVehicle(db, id);
  await db.vehicle.delete({ where: { id } });
  const contract = vehicle.contracts[0];
  if (contract) {
    await db.vehicleContract.delete({ where: { id: contract.id } });
  }
  await writeAudit({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "XOA_XE",
    entityType: "Vehicle",
    entityId: id,
    before: { plateNumber: vehicle.plateNumber },
  });
}

export async function listDeletedVehicles(tenantId: string) {
  const cutoff = vnStartOfDay().subtract(30, "day").toDate();
  return prisma.vehicle.findMany({
    where: {
      tenantId,
      deletedAt: { not: null, gte: cutoff },
    },
    include: { customer: true },
    orderBy: { deletedAt: "desc" },
  });
}

export async function restoreVehicle(tenantId: string, userId: string, id: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, tenantId, deletedAt: { not: null } },
  });
  if (!vehicle) {
    throw new AppError("Không tìm thấy xe đã xoá.", "NOT_FOUND");
  }
  await prisma.vehicle.update({
    where: { id },
    data: { deletedAt: null },
  });
  await prisma.vehicleContract.updateMany({
    where: { vehicleId: id, tenantId },
    data: { deletedAt: null },
  });
  await writeAudit({
    tenantId,
    userId,
    action: "KHOI_PHUC_XE",
    entityType: "Vehicle",
    entityId: id,
  });
}

export async function importVehiclesFromRows(
  db: TenantClient,
  ctx: { tenantId: string; branchId: string; userId: string },
  rows: VehicleInput[],
) {
  const slots = await remainingVehicleSlots(ctx.tenantId);
  const accepted = rows.slice(0, Number.isFinite(slots) ? slots : rows.length);
  let created = 0;
  const errors: string[] = [];
  for (const [index, row] of accepted.entries()) {
    try {
      await createVehicle(db, ctx, row);
      created += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lỗi không rõ";
      errors.push(`Dòng ${index + 2}: ${message}`);
    }
  }
  const skipped = rows.length - accepted.length;
  if (skipped > 0) {
    errors.unshift(
      `Gói hiện tại chỉ còn chỗ cho ${accepted.length} xe. ${skipped} dòng chưa được nhập.`,
    );
  }
  return { created, errors };
}

export function advanceDueDate(from: Date, cycle: BillingCycle) {
  return addBillingCycle(from, cycle);
}
