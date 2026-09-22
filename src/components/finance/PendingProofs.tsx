"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { confirmProofPaidAction } from "@/actions/collect";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";
import { formatVnDateTime } from "@/lib/datetime";
import { touchBtnClass } from "@/lib/utils";

type ProofRow = {
  id: string;
  transferContent: string;
  amount: number;
  status: string;
  proofImageUrl: string | null;
  months: number;
  createdAt: Date | string;
};

export function PendingProofs({ rows }: { rows: ProofRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (rows.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      <p className="text-lg font-bold">Chờ đối chiếu chuyển khoản</p>
      {rows.map((row) => (
        <div key={row.id} className="rounded-2xl bg-white p-4">
          <p className="font-bold">{row.transferContent}</p>
          <p>
            {formatVnd(row.amount)} · {row.months} tháng
          </p>
          <p className="text-sm text-neutral-600">
            {row.status === "PROOF" ? "Đã gửi ảnh" : "Chờ tiền / chờ ảnh"} · {formatVnDateTime(row.createdAt)}
          </p>
          {row.proofImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.proofImageUrl} alt="Chứng từ" className="mt-2 max-h-40 rounded-xl" />
          ) : null}
          <Button
            className={`${touchBtnClass} mt-3`}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await confirmProofPaidAction(row.id);
                if (!result.ok) toast.error(result.message);
                else {
                  toast.success(`Đã ghi nhận ${result.data.amountLabel}.`);
                  if (result.data.receiptUrl) router.push(result.data.receiptUrl);
                  else router.refresh();
                }
              })
            }
          >
            Đã nhận tiền — ghi sổ
          </Button>
        </div>
      ))}
    </div>
  );
}
