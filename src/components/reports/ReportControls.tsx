"use client";

import { useRouter } from "next/navigation";
import { touchInputClass } from "@/lib/utils";

export function MonthPicker({ month }: { month: string }) {
  const router = useRouter();
  return (
    <label className="block space-y-2">
      <span className="text-base font-semibold">Tháng xem</span>
      <input
        className={touchInputClass}
        type="month"
        value={month}
        onChange={(e) => router.push(`/bao-cao?month=${e.target.value}`)}
      />
    </label>
  );
}

export function PrintButton() {
  return (
    <button
      type="button"
      className="h-14 w-full rounded-xl bg-[#0F4C5C] text-base font-semibold text-white print:hidden"
      onClick={() => window.print()}
    >
      In / lưu PDF
    </button>
  );
}
