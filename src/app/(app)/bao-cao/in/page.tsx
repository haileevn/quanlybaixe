import Link from "next/link";
import { redirect } from "next/navigation";
import { PrintButton } from "@/components/reports/ReportControls";
import { getTenantContext } from "@/lib/session";
import { canViewProfit, canViewReports } from "@/lib/rbac";
import { formatVnd, toNumber } from "@/lib/money";
import { formatVnDate, nowVn } from "@/lib/datetime";
import { getTenantOrThrow } from "@/services/tenant.service";
import { listDebts } from "@/services/due.service";
import {
  INVOICE_SOURCE_LABEL,
  listCashRows,
  listInvoiceRows,
  listVehicleExport,
  monthRange,
} from "@/services/report.service";

export default async function PrintReportPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; month?: string }>;
}) {
  const { db, user } = await getTenantContext();
  if (!canViewReports(user.role)) redirect("/");
  const { kind = "thu-chi", month: monthParam } = await searchParams;
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : nowVn().format("YYYY-MM");
  const range = monthRange(month);
  const tenant = await getTenantOrThrow(user.tenantId);
  const profit = canViewProfit(user.role);

  if ((kind === "thu-chi" || kind === "hoa-don") && !profit) redirect("/bao-cao");

  let title = "Báo cáo";
  let rows: { left: string; mid: string; right: string }[] = [];

  if (kind === "xe") {
    title = "Danh sách xe tháng";
    const data = await listVehicleExport(db);
    rows = data.map((row) => ({
      left: row.plateNumber,
      mid: `${row.ownerName} · ${row.phone}`,
      right: formatVnd(row.monthlyPrice),
    }));
  } else if (kind === "cong-no") {
    title = "Công nợ";
    const data = await listDebts(db);
    rows = data.map((row) => ({
      left: row.label,
      mid: `${row.customerName} · ${row.sourceLabel}`,
      right: formatVnd(row.amount),
    }));
  } else if (kind === "hoa-don") {
    title = `Hoá đơn tháng ${range.label}`;
    const data = await listInvoiceRows(db, range.start, range.end);
    rows = data.map((row) => ({
      left: formatVnDate(row.createdAt),
      mid: `${row.customer.name} · ${INVOICE_SOURCE_LABEL[row.source]}`,
      right: formatVnd(toNumber(row.totalAmount)),
    }));
  } else {
    title = `Sổ thu chi tháng ${range.label}`;
    const data = await listCashRows(db, range.start, range.end);
    rows = data.map((row) => ({
      left: formatVnDate(row.occurredAt),
      mid: `${row.type === "THU" ? "Thu" : "Chi"} · ${row.note ?? ""}`,
      right: `${row.type === "THU" ? "+" : "−"}${formatVnd(row.amount)}`,
    }));
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-white px-4 py-6 print:max-w-none">
      <div className="mb-4 space-y-2 print:hidden">
        <PrintButton />
        <Link href="/bao-cao" className="block text-center text-base font-semibold text-[#0F4C5C]">
          Quay lại báo cáo
        </Link>
      </div>
      <p className="text-sm font-semibold text-[#0F4C5C]">Sổ bãi xe</p>
      <h1 className="text-2xl font-black">{title}</h1>
      <p className="mb-4 text-base">{tenant.name}</p>
      <table className="w-full text-left text-sm">
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.left}-${index}`} className="border-b border-neutral-200">
              <td className="py-2 font-bold">{row.left}</td>
              <td className="py-2">{row.mid}</td>
              <td className="py-2 text-right font-bold">{row.right}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="mt-6 text-center">Không có dữ liệu.</p> : null}
    </div>
  );
}
