"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatVnd } from "@/lib/money";
import { touchBtnClass } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function PublicPayBox({
  token,
  amount,
  transferContent,
  qrDataUrl,
  bankName,
  accountNo,
  accountName,
  label,
  months,
  status,
}: {
  token: string;
  amount: number;
  transferContent: string;
  qrDataUrl: string;
  bankName: string;
  accountNo: string;
  accountName: string;
  label: string;
  months: number;
  status: string;
}) {
  const [pending, start] = useTransition();
  const [uploaded, setUploaded] = useState(status === "PROOF" || status === "PAID");

  if (status === "PAID") {
    return <p className="rounded-2xl bg-white p-5 text-lg font-bold">Đã nhận tiền. Cảm ơn bạn.</p>;
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white p-5 text-center">
      <h1 className="text-2xl font-black">Đóng tiền {label}</h1>
      <p>{months} tháng · {formatVnd(amount)}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrDataUrl} alt="QR chuyển khoản" className="mx-auto w-56" />
      <p>{bankName}</p>
      <p className="text-lg font-bold">{accountNo}</p>
      <p>{accountName}</p>
      <p className="rounded-xl bg-amber-50 p-3 font-semibold">Nội dung: {transferContent}</p>
      <p className="text-sm text-neutral-600">Quét QR. Có thể gửi ảnh biên lai nếu chuyển tay.</p>
      <input
        type="file"
        accept="image/*"
        className="block w-full text-sm"
        disabled={pending || uploaded}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          start(async () => {
            const form = new FormData();
            form.set("token", token);
            form.set("file", file);
            const res = await fetch("/api/thanh-toan/chung-tu", { method: "POST", body: form });
            const json = (await res.json()) as { message?: string };
            if (!res.ok) toast.error(json.message ?? "Không gửi được ảnh.");
            else {
              toast.success("Đã nhận ảnh. Bãi xe sẽ đối chiếu.");
              setUploaded(true);
            }
          });
        }}
      />
      {uploaded ? <p className="font-semibold text-[#0F4C5C]">Đã gửi ảnh chứng từ.</p> : null}
      <Button className={touchBtnClass} disabled>
        {pending ? "Đang gửi..." : "Giữ nguyên nội dung khi chuyển"}
      </Button>
    </div>
  );
}
