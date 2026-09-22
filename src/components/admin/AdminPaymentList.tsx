"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { approvePaymentAction, rejectPaymentAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";
import { formatVnDateTime } from "@/lib/datetime";

type Row = {
  id: string;
  tenantName: string;
  amount: number;
  transferContent: string | null;
  createdAt: Date | string;
};

export function AdminPaymentList({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (rows.length === 0) {
    return <p className="rounded-2xl bg-white p-6 text-center">Không có khoản chờ duyệt.</p>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id} className="rounded-2xl bg-white p-4">
          <p className="text-lg font-bold">{row.tenantName}</p>
          <p className="text-2xl font-black">{formatVnd(row.amount)}</p>
          <p className="text-sm">Nội dung: {row.transferContent}</p>
          <p className="mb-3 text-sm text-neutral-600">{formatVnDateTime(row.createdAt)}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await approvePaymentAction(row.id);
                  if (!result.ok) toast.error(result.message);
                  else {
                    toast.success("Đã duyệt, gói đã gia hạn.");
                    router.refresh();
                  }
                })
              }
            >
              Duyệt
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await rejectPaymentAction(row.id);
                  if (!result.ok) toast.error(result.message);
                  else {
                    toast.success("Đã từ chối.");
                    router.refresh();
                  }
                })
              }
            >
              Từ chối
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
