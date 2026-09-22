"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { sendCustomerSmsAction } from "@/actions/reminders";
import { Button } from "@/components/ui/button";
import { touchBtnClass, touchInputClass } from "@/lib/utils";

export function SendSmsButton({
  phone,
  defaultMessage,
}: {
  phone: string;
  defaultMessage: string;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(phone);
  const [body, setBody] = useState(defaultMessage);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <Button type="button" variant="outline" className={touchBtnClass} onClick={() => setOpen(true)}>
        Nhắn SMS
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-[#0F4C5C]/10">
      <p className="text-lg font-bold">Nhắn khách</p>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Số điện thoại</span>
        <input
          className={touchInputClass}
          inputMode="tel"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </label>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Nội dung</span>
        <textarea
          className={touchInputClass + " h-28 py-3"}
          maxLength={500}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <Button
        className={touchBtnClass}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await sendCustomerSmsAction({ phone: to, body });
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            if (result.data.delivered) toast.success("Đã nhắn cho khách.");
            else if (!result.data.configured) {
              toast.success("Đã ghi tin. Chưa kết nối nhà mạng nên chưa nhắn ra máy khách.");
            } else toast.error("Chưa nhắn được. Thử lại sau.");
            setOpen(false);
          })
        }
      >
        {pending ? "Đang gửi..." : "Gửi tin"}
      </Button>
    </div>
  );
}
