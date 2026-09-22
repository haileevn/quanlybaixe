import { notFound } from "next/navigation";
import { PrintButton } from "@/components/reports/ReportControls";
import { formatVnd, toNumber } from "@/lib/money";
import { formatVnDate } from "@/lib/datetime";
import { getReceiptByToken } from "@/services/collect.service";
import { INVOICE_SOURCE_LABEL } from "@/services/report.service";

export default async function PublicReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const invoice = await getReceiptByToken(token);
    return (
      <div className="rounded-2xl bg-white px-4 py-6 print:shadow-none">
        <div className="mb-4 print:hidden">
          <PrintButton />
        </div>
        <p className="text-sm font-semibold text-[#0F4C5C]">Sổ bãi xe</p>
        <h1 className="text-2xl font-black">Biên lai thu tiền</h1>
        <p>{invoice.tenant.name}</p>
        {invoice.branch.name ? <p className="text-sm">{invoice.branch.name}</p> : null}
        <p className="mb-4 text-sm">{formatVnDate(invoice.createdAt)}</p>
        <p className="text-lg font-bold">{invoice.customer.name}</p>
        <p>{invoice.customer.phone}</p>
        <p className="mb-4 text-sm">{INVOICE_SOURCE_LABEL[invoice.source] ?? invoice.source}</p>
        <table className="w-full text-left text-sm">
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-2">{item.description}</td>
                <td className="py-2 text-right font-bold">{formatVnd(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-right text-xl font-black">Tổng {formatVnd(toNumber(invoice.totalAmount))}</p>
      </div>
    );
  } catch {
    notFound();
  }
}
