import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/reports/ReportControls";
import { getTenantContext } from "@/lib/session";
import { canViewProfit } from "@/lib/rbac";
import { formatVnd, toNumber } from "@/lib/money";
import { formatVnDate } from "@/lib/datetime";
import { getTenantOrThrow } from "@/services/tenant.service";
import { getInvoice, INVOICE_SOURCE_LABEL } from "@/services/report.service";

const STATUS_LABEL: Record<string, string> = {
  DA_THANH_TOAN: "Đã thu",
  CHUA_THANH_TOAN: "Chưa thu",
  HUY: "Huỷ",
};

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { db, user } = await getTenantContext();
  if (!canViewProfit(user.role)) redirect("/bao-cao");
  const { id } = await params;
  const invoice = await getInvoice(db, id);
  if (!invoice) notFound();
  const tenant = await getTenantOrThrow(user.tenantId);

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-white px-4 py-6 print:max-w-none">
      <div className="mb-4 space-y-2 print:hidden">
        <PrintButton />
        <Link href="/bao-cao" className="block text-center text-base font-semibold text-[#0F4C5C]">
          Quay lại báo cáo
        </Link>
      </div>
      <p className="text-sm font-semibold text-[#0F4C5C]">Sổ bãi xe</p>
      <h1 className="text-2xl font-black">Hoá đơn</h1>
      <p className="text-base">{tenant.name}</p>
      {invoice.branch.name ? <p className="text-sm">{invoice.branch.name}</p> : null}
      <p className="mb-4 text-sm">{formatVnDate(invoice.createdAt)}</p>

      <div className="mb-4 rounded-xl border border-neutral-200 p-3">
        <p className="text-lg font-bold">{invoice.customer.name}</p>
        <p>{invoice.customer.phone}</p>
        <p className="text-sm">
          {INVOICE_SOURCE_LABEL[invoice.source] ?? invoice.source} · {STATUS_LABEL[invoice.status]}
        </p>
        <p className="text-sm">
          Kỳ {formatVnDate(invoice.periodStart)} — {formatVnDate(invoice.periodEnd)}
        </p>
      </div>

      <table className="w-full text-left text-sm">
        <tbody>
          {invoice.items.map((item) => (
            <tr key={item.id} className="border-b border-neutral-200">
              <td className="py-2">{item.description}</td>
              <td className="py-2 text-right font-bold">{formatVnd(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-right text-xl font-black">Tổng {formatVnd(toNumber(invoice.totalAmount))}</p>
      <p className="text-right text-base">Đã thu {formatVnd(toNumber(invoice.paidAmount))}</p>
      {invoice.note ? <p className="mt-3 text-sm">Ghi chú: {invoice.note}</p> : null}
    </div>
  );
}
