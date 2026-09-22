import { prisma } from "@/lib/prisma";
import type { TenantClient } from "@/lib/prisma-tenant";
import { daysUntil, vnStartOfDay } from "@/lib/datetime";
import { toNumber } from "@/lib/money";

export type DueSource = "XE_THANG" | "PHONG_TRO" | "MAT_BANG" | "DICH_VU" | "SAC_DIEN";

export type DueItem = {
  source: DueSource;
  sourceLabel: string;
  targetType: string;
  targetId: string;
  vehicleId?: string;
  roomId?: string;
  kioskId?: string;
  customerId: string;
  customerName: string;
  phone: string;
  label: string;
  amount: number;
  nextDueDate: Date;
};

export function dueItemHref(item: Pick<DueItem, "source" | "vehicleId" | "roomId" | "kioskId" | "targetId">) {
  if (item.source === "XE_THANG" && item.vehicleId) return `/xe-thang/${item.vehicleId}`;
  if (item.source === "PHONG_TRO" && item.roomId) return `/phong-tro/${item.roomId}`;
  if (item.source === "MAT_BANG" && item.kioskId) return `/mat-bang/${item.kioskId}`;
  if (item.source === "DICH_VU") return "/dich-vu";
  return "/sap-toi-han";
}

export function dueTone(date: Date) {
  const days = daysUntil(date);
  if (days < -3) return "red" as const;
  if (days < 0) return "yellow" as const;
  return "green" as const;
}

export async function listDueItems(
  db: TenantClient,
  range?: { from: Date; to: Date },
) {
  const items: DueItem[] = [];
  const dateFilter = range
    ? { gte: range.from, lte: range.to }
    : undefined;

  const vehicles = await db.vehicleContract.findMany({
    where: {
      status: "DANG_GUI",
      ...(dateFilter ? { nextDueDate: dateFilter } : {}),
    },
    include: { vehicle: { include: { customer: true } } },
    orderBy: { nextDueDate: "asc" },
    take: 200,
  });
  for (const row of vehicles) {
    items.push({
      source: "XE_THANG",
      sourceLabel: "Xe tháng",
      targetType: "VehicleContract",
      targetId: row.id,
      vehicleId: row.vehicleId,
      customerId: row.vehicle.customerId,
      customerName: row.vehicle.customer.name,
      phone: row.vehicle.customer.phone,
      label: row.vehicle.plateNumber,
      amount: toNumber(row.monthlyPrice),
      nextDueDate: row.nextDueDate,
    });
  }

  const rooms = await db.roomContract.findMany({
    where: {
      status: "DANG_GUI",
      ...(dateFilter ? { nextDueDate: dateFilter } : {}),
    },
    include: { customer: true, room: true },
    orderBy: { nextDueDate: "asc" },
    take: 200,
  });
  for (const row of rooms) {
    items.push({
      source: "PHONG_TRO",
      sourceLabel: "Phòng trọ",
      targetType: "RoomContract",
      targetId: row.id,
      roomId: row.roomId,
      customerId: row.customerId,
      customerName: row.customer.name,
      phone: row.customer.phone,
      label: row.room.code,
      amount: toNumber(row.monthlyPrice),
      nextDueDate: row.nextDueDate,
    });
  }

  const kiosks = await db.kioskContract.findMany({
    where: {
      status: "DANG_GUI",
      ...(dateFilter ? { nextDueDate: dateFilter } : {}),
    },
    include: { customer: true, kiosk: true },
    orderBy: { nextDueDate: "asc" },
    take: 200,
  });
  for (const row of kiosks) {
    items.push({
      source: "MAT_BANG",
      sourceLabel: "Mặt bằng",
      targetType: "KioskContract",
      targetId: row.id,
      kioskId: row.kioskId,
      customerId: row.customerId,
      customerName: row.customer.name,
      phone: row.customer.phone,
      label: row.kiosk.code,
      amount: toNumber(row.monthlyPrice),
      nextDueDate: row.nextDueDate,
    });
  }

  const services = await db.serviceSubscription.findMany({
    where: {
      status: "DANG_GUI",
      nextDueDate: dateFilter ? dateFilter : { not: null },
    },
    include: { customer: true, serviceType: true },
    orderBy: { nextDueDate: "asc" },
    take: 200,
  });
  for (const row of services) {
    if (!row.nextDueDate) continue;
    items.push({
      source: "DICH_VU",
      sourceLabel: "Dịch vụ",
      targetType: "ServiceSubscription",
      targetId: row.id,
      customerId: row.customerId,
      customerName: row.customer.name,
      phone: row.customer.phone,
      label: row.serviceType.name,
      amount: toNumber(row.price),
      nextDueDate: row.nextDueDate,
    });
  }

  items.sort((a, b) => a.nextDueDate.getTime() - b.nextDueDate.getTime());
  return items;
}

export async function listDebts(db: TenantClient) {
  const today = vnStartOfDay().toDate();
  const items = await listDueItems(db, {
    from: vnStartOfDay().subtract(3, "year").toDate(),
    to: today,
  });
  return items.filter((item) => item.nextDueDate < today);
}

export async function listDueForTenantRaw(tenantId: string) {
  const items = [];
  const vehicles = await prisma.vehicleContract.findMany({
    where: { tenantId, status: "DANG_GUI", deletedAt: null },
    include: { vehicle: { include: { customer: true } } },
  });
  for (const row of vehicles) {
    items.push({
      tenantId,
      source: "XE_THANG" as const,
      sourceLabel: "Xe tháng",
      targetType: "VehicleContract",
      targetId: row.id,
      vehicleId: row.vehicleId,
      customerId: row.vehicle.customerId,
      customerName: row.vehicle.customer.name,
      phone: row.vehicle.customer.phone,
      label: row.vehicle.plateNumber,
      amount: toNumber(row.monthlyPrice),
      nextDueDate: row.nextDueDate,
    });
  }
  const rooms = await prisma.roomContract.findMany({
    where: { tenantId, status: "DANG_GUI", deletedAt: null },
    include: { customer: true, room: true },
  });
  for (const row of rooms) {
    items.push({
      tenantId,
      source: "PHONG_TRO" as const,
      sourceLabel: "Phòng trọ",
      targetType: "RoomContract",
      targetId: row.id,
      roomId: row.roomId,
      customerId: row.customerId,
      customerName: row.customer.name,
      phone: row.customer.phone,
      label: row.room.code,
      amount: toNumber(row.monthlyPrice),
      nextDueDate: row.nextDueDate,
    });
  }
  const kiosks = await prisma.kioskContract.findMany({
    where: { tenantId, status: "DANG_GUI", deletedAt: null },
    include: { customer: true, kiosk: true },
  });
  for (const row of kiosks) {
    items.push({
      tenantId,
      source: "MAT_BANG" as const,
      sourceLabel: "Mặt bằng",
      targetType: "KioskContract",
      targetId: row.id,
      kioskId: row.kioskId,
      customerId: row.customerId,
      customerName: row.customer.name,
      phone: row.customer.phone,
      label: row.kiosk.code,
      amount: toNumber(row.monthlyPrice),
      nextDueDate: row.nextDueDate,
    });
  }
  const services = await prisma.serviceSubscription.findMany({
    where: { tenantId, status: "DANG_GUI", deletedAt: null, nextDueDate: { not: null } },
    include: { customer: true, serviceType: true },
  });
  for (const row of services) {
    if (!row.nextDueDate) continue;
    items.push({
      tenantId,
      source: "DICH_VU" as const,
      sourceLabel: "Dịch vụ",
      targetType: "ServiceSubscription",
      targetId: row.id,
      customerId: row.customerId,
      customerName: row.customer.name,
      phone: row.customer.phone,
      label: row.serviceType.name,
      amount: toNumber(row.price),
      nextDueDate: row.nextDueDate,
    });
  }
  return items;
}
