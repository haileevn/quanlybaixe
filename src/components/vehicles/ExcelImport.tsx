"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { importVehiclesFileAction } from "@/actions/vehicles";
import { PlanLimitDialog } from "@/components/layout/PlanLimitDialog";
import { touchBtnClass } from "@/lib/utils";

export function ExcelImport() {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [limitOpen, setLimitOpen] = useState(false);
  const [limitMessage, setLimitMessage] = useState("");

  return (
    <div className="space-y-4">
      <p className="text-base leading-relaxed text-neutral-700">
        Cột theo thứ tự: biển số, loại xe, tên chủ, SĐT, phòng/địa chỉ, giá tháng, ngày bắt đầu
        (YYYY-MM-DD), ghi chú. Loại xe ghi: xe máy / xe máy điện / ô tô / xe đạp điện.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          start(async () => {
            const result = await importVehiclesFileAction(data);
            if (!result.ok) {
              if (result.code === "PLAN_LIMIT") {
                setLimitMessage(result.message);
                setLimitOpen(true);
                return;
              }
              toast.error(result.message);
              return;
            }
            setErrors(result.data.errors);
            toast.success(`Đã nhập ${result.data.created} xe.`);
          });
        }}
        className="space-y-4"
      >
        <input
          type="file"
          name="file"
          required
          accept=".xlsx,.xls,.csv"
          className="block w-full rounded-xl bg-white p-4 text-base ring-1 ring-neutral-200"
        />
        <button className={touchBtnClass + " bg-[#0F4C5C] text-white"} disabled={pending}>
          {pending ? "Đang nhập..." : "Nhập danh sách"}
        </button>
      </form>
      {errors.length ? (
        <ul className="space-y-1 rounded-xl bg-amber-50 p-4 text-sm">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}
      <PlanLimitDialog open={limitOpen} message={limitMessage} onOpenChange={setLimitOpen} />
    </div>
  );
}
