import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ReportCharts } from "@/components/reports/ReportCharts";
import { MonthPicker } from "@/components/reports/ReportControls";
import { getTenantContext } from "@/lib/session";
import { canViewProfit, canViewReports } from "@/lib/rbac";
import { formatVnd, toNumber } from "@/lib/money";
import { nowVn, formatVnDate } from "@/lib/datetime";
import {
  getChartData,
  getDashboardExtras,
  INVOICE_SOURCE_LABEL,
  listCashRows,
  listInvoiceRows,
  monthRange,
  occupancyLabel,
} from "@/services/report.service";
import { listDebts } from "@/services/due.service";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { db, user } = await getTenantContext();
  if (!canViewReports(user.role)) redirect("/");
  const { month: monthParam } = await searchParams;
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : nowVn().format("YYYY-MM");
  const range = monthRange(month);
  const extras = await getDashboardExtras(db);
  const showProfit = canViewProfit(user.role);
  const charts = showProfit ? await getChartData(db) : null;
  const cash = showProfit ? await listCashRows(db, range.start, range.end) : [];
  const invoices = showProfit ? await listInvoiceRows(db, range.start, range.end) : [];
  const debts = await listDebts(db);

  return (
    <AppShell title="Báo cáo">
      <p className="mb-4 text-base text-neutral-600">Tháng {range.label}</p>
      <div className="mb-4">
        <MonthPicker month={month} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        {showProfit ? (
          <div className="rounded-2xl bg-[#0F4C5C] p-4 text-white">
            <p className="text-sm text-amber-200">Thu tháng này</p>
            <p className="text-2xl font-black">{formatVnd(extras.monthIncome)}</p>
            <p className="text-sm text-white/80">Tháng trước {formatVnd(extras.prevIncome)}</p>
          </div>
        ) : null}
        <div className="rounded-2xl bg-white p-4">
          <p className="text-sm text-neutral-600">Đang nợ</p>
          <p className="text-2xl font-black">{formatVnd(extras.debtTotal)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4">
          <p className="text-sm text-neutral-600">Phòng đang thuê</p>
          <p className="text-lg font-bold">{occupancyLabel(extras.roomsRented, extras.rooms)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4">
          <p className="text-sm text-neutral-600">Mặt bằng đang thuê</p>
          <p className="text-lg font-bold">{occupancyLabel(extras.kiosksRented, extras.kiosks)}</p>
        </div>
      </div>

      {charts ? <div className="mb-5"><ReportCharts months={charts.months} sources={charts.sources} /></div> : null}

      <div className="space-y-3">
        <p className="text-lg font-bold">Xuất file</p>
        {showProfit ? (
          <>
            <a className="block rounded-2xl bg-white p-4 text-lg font-bold" href={`/api/bao-cao/excel?kind=thu-chi&month=${month}`}>
              Excel sổ thu chi
            </a>
            <Link className="block rounded-2xl bg-white p-4 text-lg font-bold" href={`/bao-cao/in?kind=thu-chi&month=${month}`}>
              In / PDF sổ thu chi
            </Link>
            <a className="block rounded-2xl bg-white p-4 text-lg font-bold" href={`/api/bao-cao/excel?kind=hoa-don&month=${month}`}>
              Excel hoá đơn
            </a>
            <Link className="block rounded-2xl bg-white p-4 text-lg font-bold" href={`/bao-cao/in?kind=hoa-don&month=${month}`}>
              In / PDF hoá đơn
            </Link>
          </>
        ) : null}
        <a className="block rounded-2xl bg-white p-4 text-lg font-bold" href={`/api/bao-cao/excel?kind=xe&month=${month}`}>
          Excel danh sách xe
        </a>
        <Link className="block rounded-2xl bg-white p-4 text-lg font-bold" href={`/bao-cao/in?kind=xe&month=${month}`}>
          In / PDF danh sách xe
        </Link>
        <a className="block rounded-2xl bg-white p-4 text-lg font-bold" href={`/api/bao-cao/excel?kind=cong-no&month=${month}`}>
          Excel công nợ
        </a>
        <Link className="block rounded-2xl bg-white p-4 text-lg font-bold" href={`/bao-cao/in?kind=cong-no&month=${month}`}>
          In / PDF công nợ
        </Link>
      </div>

      {showProfit && cash.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-bold">Thu chi tháng này</h2>
          <ul className="space-y-2">
            {cash.slice(0, 8).map((row) => (
              <li key={row.id} className="rounded-xl bg-white p-3">
                <p className="font-bold">
                  {row.type === "THU" ? "+" : "−"}
                  {formatVnd(row.amount)}
                </p>
                <p className="text-sm">{formatVnDate(row.occurredAt)} · {row.note ?? ""}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showProfit && invoices.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-bold">Hoá đơn gần đây</h2>
          <ul className="space-y-2">
            {invoices.slice(0, 8).map((row) => (
              <li key={row.id}>
                <Link href={`/hoa-don/${row.id}`} className="block rounded-xl bg-white p-3">
                  <p className="font-bold">{formatVnd(toNumber(row.totalAmount))} · {row.customer.name}</p>
                  <p className="text-sm">
                    {INVOICE_SOURCE_LABEL[row.source]} · {row.status === "DA_THANH_TOAN" ? "Đã thu" : "Chưa thu"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {debts.length > 0 ? (
        <p className="mt-4 text-sm text-neutral-600">{debts.length} khách đang nợ.</p>
      ) : null}
    </AppShell>
  );
}
