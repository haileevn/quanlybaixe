"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { runReminderNowAction, saveReminderConfigAction } from "@/actions/reminders";
import { Button } from "@/components/ui/button";
import { touchBtnClass } from "@/lib/utils";
import { formatVnDateTime } from "@/lib/datetime";

const BEFORE = [7, 3, 0];
const OVERDUE = [1, 3, 7];

export function ReminderSettings({
  daysBefore,
  daysOverdue,
  smsEnabled,
  smsReady,
  logs,
}: {
  daysBefore: number[];
  daysOverdue: number[];
  smsEnabled: boolean;
  smsReady: boolean;
  logs: { id: string; toAddress: string; body: string | null; status: string; createdAt: Date }[];
}) {
  const router = useRouter();
  const [before, setBefore] = useState(daysBefore);
  const [overdue, setOverdue] = useState(daysOverdue);
  const [smsOn, setSmsOn] = useState(smsEnabled);
  const [pending, start] = useTransition();

  function toggle(list: number[], value: number, setter: (next: number[]) => void) {
    setter(list.includes(value) ? list.filter((n) => n !== value) : [...list, value].sort((a, b) => b - a));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-600">Nhắc trước hạn (ngày)</p>
      <div className="flex flex-wrap gap-2">
        {BEFORE.map((n) => (
          <button
            key={n}
            type="button"
            className={`rounded-full px-3 py-2 text-sm font-bold ${before.includes(n) ? "bg-[#0F4C5C] text-white" : "bg-neutral-100"}`}
            onClick={() => toggle(before, n, setBefore)}
          >
            {n === 0 ? "Đúng ngày" : `Trước ${n} ngày`}
          </button>
        ))}
      </div>
      <p className="text-sm text-neutral-600">Nhắc khi quá hạn</p>
      <div className="flex flex-wrap gap-2">
        {OVERDUE.map((n) => (
          <button
            key={n}
            type="button"
            className={`rounded-full px-3 py-2 text-sm font-bold ${overdue.includes(n) ? "bg-[#0F4C5C] text-white" : "bg-neutral-100"}`}
            onClick={() => toggle(overdue, n, setOverdue)}
          >
            Quá {n} ngày
          </button>
        ))}
      </div>

      <label className="flex items-center gap-3 py-1 text-base font-semibold">
        <input
          type="checkbox"
          className="size-5"
          checked={smsOn}
          onChange={(e) => setSmsOn(e.target.checked)}
        />
        Tự nhắn SMS cho khách khi tới hạn
      </label>
      <p className="text-sm text-neutral-600">
        {smsReady
          ? "Hệ thống đã kết nối nhà mạng. Tin sẽ nhắn ra máy khách."
          : "Chưa kết nối nhà mạng SMS. Tin được ghi trong sổ, chưa nhắn ra máy khách."}
      </p>

      <Button
        className={touchBtnClass}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const saved = await saveReminderConfigAction({
              daysBefore: before,
              daysOverdue: overdue,
              smsEnabled: smsOn,
            });
            if (!saved.ok) toast.error(saved.message);
            else toast.success("Đã lưu lịch nhắc.");
          })
        }
      >
        Lưu lịch nhắc
      </Button>
      <Button
        variant="outline"
        className={touchBtnClass}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await runReminderNowAction();
            if (!result.ok) toast.error(result.message);
            else {
              toast.success(`Đã nhắc ${result.data.sent} khách` + (result.data.sms ? `, nhắn ${result.data.sms} SMS.` : "."));
              router.refresh();
            }
          })
        }
      >
        Gửi nhắc hạn ngay
      </Button>

      {logs.length > 0 ? (
        <div className="pt-2">
          <p className="mb-2 text-base font-bold">Tin SMS gần đây</p>
          <ul className="space-y-2">
            {logs.map((row) => (
              <li key={row.id} className="rounded-xl bg-neutral-50 p-3 text-sm">
                <p className="font-bold">
                  {row.toAddress} · {row.status === "SENT" ? "Đã nhắn" : row.status === "FAILED" ? "Lỗi" : "Chỉ ghi sổ"}
                </p>
                <p className="text-neutral-600">{row.body}</p>
                <p className="text-xs text-neutral-500">{formatVnDateTime(row.createdAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
