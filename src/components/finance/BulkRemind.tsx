"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { sendBulkRemindAction } from "@/actions/reminders";
import { Button } from "@/components/ui/button";
import { touchBtnClass, touchInputClass } from "@/lib/utils";
import type { DueItem } from "@/services/due.service";

const DEFAULT_TEMPLATE =
  "Chào {tên}, {mục} tới hạn đóng {số tiền} vào ngày {hạn}. Nhờ đóng giúp ạ.";

export function BulkRemind({ items }: { items: DueItem[] }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [pending, start] = useTransition();
  const chosen = items.filter((item) => selected[item.targetId]);

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-[#0F4C5C]/10">
      <p className="text-lg font-bold">Nhắn SMS hàng loạt</p>
      <p className="text-sm text-neutral-600">
        Dùng {`{tên}`}, {`{mục}`}, {`{số tiền}`}, {`{hạn}`}. Tin gửi tới số điện thoại khách.
      </p>
      <textarea
        className={touchInputClass + " h-28 py-3"}
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
      />
      <ul className="max-h-48 space-y-2 overflow-auto">
        {items.map((item) => (
          <li key={item.targetId}>
            <label className="flex items-center gap-3 text-base">
              <input
                type="checkbox"
                className="size-5"
                checked={Boolean(selected[item.targetId])}
                onChange={(e) =>
                  setSelected((prev) => ({ ...prev, [item.targetId]: e.target.checked }))
                }
              />
              {item.label} · {item.customerName} · {item.phone}
            </label>
          </li>
        ))}
      </ul>
      <Button
        className={touchBtnClass}
        disabled={pending || chosen.length === 0}
        onClick={() =>
          start(async () => {
            const result = await sendBulkRemindAction({
              template,
              items: chosen.map((item) => ({
                customerName: item.customerName,
                phone: item.phone,
                label: item.label,
                amount: item.amount,
                nextDueDate: new Date(item.nextDueDate).toISOString(),
              })),
            });
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            const { delivered, sent, configured } = result.data;
            if (delivered > 0) toast.success(`Đã nhắn ${delivered}/${sent} khách.`);
            else if (!configured) {
              toast.success(`Đã ghi ${sent} tin. Chưa kết nối nhà mạng nên chưa nhắn ra máy khách.`);
            } else toast.error("Chưa nhắn được. Kiểm tra nhà mạng SMS.");
          })
        }
      >
        {pending ? "Đang gửi..." : `Gửi SMS (${chosen.length})`}
      </Button>
    </div>
  );
}
