"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { closeCashbookAction } from "@/actions/cash";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";
import { formatVnDate } from "@/lib/datetime";
import { touchBtnClass } from "@/lib/utils";

export function CashbookPanel({
  day,
  opening,
  totalIn,
  totalOut,
  closing,
  closed,
}: {
  day: Date;
  opening: number;
  totalIn: number;
  totalOut: number;
  closing: number;
  closed: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-[#0F4C5C] p-5 text-white">
        <p className="text-sm text-amber-200">Sổ ngày {formatVnDate(day)}</p>
        <p className="mt-2 text-sm">Đầu kỳ</p>
        <p className="text-2xl font-bold">{formatVnd(opening)}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-base">
          <div>
            <p className="text-white/70">Tổng thu</p>
            <p className="text-xl font-bold">{formatVnd(totalIn)}</p>
          </div>
          <div>
            <p className="text-white/70">Tổng chi</p>
            <p className="text-xl font-bold">{formatVnd(totalOut)}</p>
          </div>
        </div>
        <p className="mt-4 text-sm">Tồn cuối</p>
        <p className="text-4xl font-black">{formatVnd(closing)}</p>
      </div>
      {closed ? (
        <p className="rounded-2xl bg-emerald-50 p-4 font-semibold">Hôm nay đã chốt sổ.</p>
      ) : (
        <Button
          className={touchBtnClass}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await closeCashbookAction();
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              toast.success("Đã chốt sổ hôm nay.");
              router.refresh();
            })
          }
        >
          {pending ? "Đang chốt..." : "Chốt sổ hôm nay"}
        </Button>
      )}
    </div>
  );
}
