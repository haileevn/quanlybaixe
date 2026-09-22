import { notFound } from "next/navigation";
import { toNumber } from "@/lib/money";
import { getPublicPayIntent } from "@/services/collect.service";
import { PublicPayBox } from "./PublicPayBox";

export default async function PublicPayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const data = await getPublicPayIntent(token);
    if (data.intent.status === "PAID") {
      return (
        <div className="rounded-2xl bg-white p-5">
          <h1 className="text-2xl font-black">Đã nhận tiền</h1>
          <p>Cảm ơn bạn đã đóng {data.label}.</p>
        </div>
      );
    }
    if (!data.qr) notFound();
    return (
      <PublicPayBox
        token={token}
        amount={toNumber(data.intent.amount)}
        transferContent={data.intent.transferContent}
        qrDataUrl={data.qr.qrDataUrl}
        bankName={data.qr.bank.bankName}
        accountNo={data.qr.bank.accountNo}
        accountName={data.qr.bank.accountName}
        label={data.label}
        months={data.intent.months}
        status={data.intent.status}
      />
    );
  } catch {
    notFound();
  }
}
