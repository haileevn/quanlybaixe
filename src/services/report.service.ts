import type { TenantClient } from "@/lib/prisma-tenant";
import { vnStartOfDay, toVn } from "@/lib/datetime";
import { toNumber } from "@/lib/money";
import { listDebts } from "@/services/due.service";
import { sumByType } from "@/services/cash.service";
import { listVehicles } from "@/services/vehicle.service";

export const INVOICE_SOURCE_LABEL: Record<string, string> = {
  XE_THANG: "Xe tháng",
  PHONG_TRO: "Phòng trọ",
  MAT_BANG: "Mặt bằng",
  SAC_DIEN: "Sạc điện",
  DICH_VU: "Dịch vụ",
  VANG_LAI: "Vãng lai",
};

export function monthRange(ym: string) {
  const start = vnStartOfDay(`${ym}-01`);
  const end = start.endOf("month");
  return { start: start.toDate(), end: end.toDate(), label: start.format("MM/YYYY") };
}

export async function getDashboardExtras(db: TenantClient) {
  const thisMonth = vnStartOfDay().startOf("month");
  const lastMonth = thisMonth.subtract(1, "month");
  const monthIncome = toNumber(await sumByType(db, "THU", thisMonth.toDate(), thisMonth.endOf("month").toDate()));
  const prevIncome = toNumber(
    await sumByType(db, "THU", lastMonth.toDate(), lastMonth.endOf("month").toDate()),
  );
  const debts = await listDebts(db);
  const debtTotal = debts.reduce((sum, row) => sum + row.amount, 0);

  const rooms = await db.room.count();
  const roomsRented = await db.room.count({ where: { status: "DANG_THUE" } });
  const kiosks = await db.kiosk.count();
  const kiosksRented = await db.kioskContract.count({ where: { status: "DANG_GUI" } });

  return {
    monthIncome,
    prevIncome,
    debtTotal,
    rooms,
    roomsRented,
    kiosks,
    kiosksRented,
  };
}

export async function getChartData(db: TenantClient) {
  const from = vnStartOfDay().startOf("month").subtract(11, "month");
  const rows = await db.transaction.findMany({
    where: { occurredAt: { gte: from.toDate() } },
    select: { type: true, amount: true, occurredAt: true, invoiceId: true },
  });
  const months: { ym: string; label: string; thu: number; chi: number }[] = [];
  for (let i = 0; i < 12; i += 1) {
    const d = from.add(i, "month");
    months.push({ ym: d.format("YYYY-MM"), label: d.format("MM/YY"), thu: 0, chi: 0 });
  }
  const byYm = new Map(months.map((m) => [m.ym, m]));
  for (const row of rows) {
    const ym = toVn(row.occurredAt).format("YYYY-MM");
    const bucket = byYm.get(ym);
    if (!bucket) continue;
    const n = toNumber(row.amount);
    if (row.type === "THU") bucket.thu += n;
    else bucket.chi += n;
  }

  const invoices = await db.invoice.findMany({
    where: {
      status: "DA_THANH_TOAN",
      createdAt: { gte: from.toDate() },
    },
    select: { source: true, totalAmount: true },
  });
  const sourceMap = new Map<string, number>();
  for (const inv of invoices) {
    const key = INVOICE_SOURCE_LABEL[inv.source] ?? inv.source;
    sourceMap.set(key, (sourceMap.get(key) ?? 0) + toNumber(inv.totalAmount));
  }
  const walkIn = rows
    .filter((row) => row.type === "THU" && !row.invoiceId)
    .reduce((sum, row) => sum + toNumber(row.amount), 0);
  if (walkIn > 0) {
    sourceMap.set("Vãng lai", (sourceMap.get("Vãng lai") ?? 0) + walkIn);
  }

  return {
    months,
    sources: [...sourceMap.entries()].map(([name, value]) => ({ name, value })),
  };
}

export async function listCashRows(db: TenantClient, from: Date, to: Date) {
  return db.transaction.findMany({
    where: { occurredAt: { gte: from, lte: to } },
    include: { expenseCategory: true, collectedBy: true },
    orderBy: { occurredAt: "desc" },
    take: 500,
  });
}

export async function listInvoiceRows(db: TenantClient, from: Date, to: Date) {
  return db.invoice.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: { customer: true, items: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
}

export async function getInvoice(db: TenantClient, id: string) {
  return db.invoice.findFirst({
    where: { id },
    include: { customer: true, items: true, branch: true },
  });
}

export async function listVehicleExport(db: TenantClient) {
  const rows = await listVehicles(db, { take: 500 });
  return rows.map((row) => ({
    plateNumber: row.plateNumber,
    vehicleType: row.vehicleType,
    ownerName: row.customer.name,
    phone: row.customer.phone,
    monthlyPrice: row.contracts[0] ? toNumber(row.contracts[0].monthlyPrice) : 0,
    nextDueDate: row.contracts[0]?.nextDueDate ?? null,
    status: row.contracts[0]?.status ?? "",
  }));
}

export function occupancyLabel(used: number, total: number) {
  if (total <= 0) return "Chưa có";
  return `${used}/${total} (${Math.round((used / total) * 100)}%)`;
}
