"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { collectKioskAction, collectRoomAction } from "@/actions/modules";
import { collectServiceAction } from "@/actions/extras";
import { TransferQr } from "@/components/finance/TransferQr";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";
import { touchBtnClass, touchInputClass } from "@/lib/utils";

export function CollectTargetButton({
  label,
  roomId,
  kioskId,
  subscriptionId,
  amount,
}: {
  label: string;
  roomId?: string;
  kioskId?: string;
  subscriptionId?: string;
  amount?: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [method, setMethod] = useState<"TIEN_MAT" | "CHUYEN_KHOAN">("TIEN_MAT");
  const [months, setMonths] = useState(1);
  const [imageUrl, setImageUrl] = useState<string>();
  const canMultiMonth = Boolean(roomId || kioskId);
  const total = (amount ?? 0) * (canMultiMonth ? months : 1);

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-[#0F4C5C]/10">
      <p className="text-lg font-bold">Thu tiền {label}</p>
      {canMultiMonth ? (
        <select className={touchInputClass} value={months} onChange={(e) => setMonths(Number(e.target.value))}>
          <option value={1}>1 tháng{amount ? ` · ${formatVnd(amount)}` : ""}</option>
          <option value={3}>3 tháng{amount ? ` · ${formatVnd(amount * 3)}` : ""}</option>
        </select>
      ) : null}
      <select
        className={touchInputClass}
        value={method}
        onChange={(e) => setMethod(e.target.value as typeof method)}
      >
        <option value="TIEN_MAT">Tiền mặt</option>
        <option value="CHUYEN_KHOAN">Chuyển khoản</option>
      </select>
      {method === "CHUYEN_KHOAN" && total > 0 ? (
        <TransferQr amount={total} addInfo={label.slice(0, 25)} />
      ) : null}
      {method === "CHUYEN_KHOAN" ? (
        <label className="block text-sm">
          Ảnh chứng từ (nếu chuyển tay)
          <input
            type="file"
            accept="image/*"
            className="mt-1 block w-full"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              start(async () => {
                const form = new FormData();
                form.set("file", file);
                const res = await fetch("/api/upload", { method: "POST", body: form });
                const json = (await res.json()) as { url?: string; message?: string };
                if (!json.url) toast.error(json.message ?? "Không tải được ảnh.");
                else {
                  setImageUrl(json.url);
                  toast.success("Đã gắn ảnh chứng từ.");
                }
              });
            }}
          />
        </label>
      ) : null}
      <Button
        className={touchBtnClass}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const payload = { method, roomId, kioskId, subscriptionId, months, imageUrl };
            const result = roomId
              ? await collectRoomAction(payload)
              : kioskId
                ? await collectKioskAction(payload)
                : await collectServiceAction(payload);
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success(`Đã thu ${result.data.amountLabel}. Hạn mới: ${result.data.nextDueLabel}`);
            if (result.data.receiptUrl) router.push(result.data.receiptUrl);
            else router.refresh();
          })
        }
      >
        {pending ? "Đang ghi..." : `Đã thu ${total ? formatVnd(total) : ""}`}
      </Button>
    </div>
  );
}
