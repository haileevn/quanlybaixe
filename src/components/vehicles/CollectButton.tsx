"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { collectPaymentAction } from "@/actions/payments";
import { createStaffPayLinkAction } from "@/actions/collect";
import { TransferQr } from "@/components/finance/TransferQr";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";
import { touchBtnClass, touchInputClass } from "@/lib/utils";

export function CollectButton({
  vehicleId,
  plateNumber,
  amount,
}: {
  vehicleId: string;
  plateNumber: string;
  amount?: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [method, setMethod] = useState<"TIEN_MAT" | "CHUYEN_KHOAN">("TIEN_MAT");
  const [months, setMonths] = useState(1);
  const [imageUrl, setImageUrl] = useState<string>();
  const [link, setLink] = useState<string>();
  const total = (amount ?? 0) * months;

  useEffect(() => {
    if (method !== "CHUYEN_KHOAN") return;
    void createStaffPayLinkAction({ vehicleId, months }).then((result) => {
      if (result.ok) setLink(result.data.payUrl);
    });
  }, [vehicleId, months, method]);

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-[#0F4C5C]/10">
      <p className="text-lg font-bold">Thu tiền {plateNumber}</p>
      <select
        className={touchInputClass}
        value={months}
        onChange={(e) => setMonths(Number(e.target.value))}
      >
        <option value={1}>1 tháng{amount ? ` · ${formatVnd(amount)}` : ""}</option>
        <option value={3}>3 tháng{amount ? ` · ${formatVnd(amount * 3)}` : ""}</option>
      </select>
      <select
        className={touchInputClass}
        value={method}
        onChange={(e) => setMethod(e.target.value as typeof method)}
      >
        <option value="TIEN_MAT">Tiền mặt</option>
        <option value="CHUYEN_KHOAN">Chuyển khoản</option>
      </select>
      {method === "CHUYEN_KHOAN" && total > 0 ? (
        <TransferQr amount={total} addInfo={`XE ${plateNumber} T${months}`.slice(0, 25)} />
      ) : null}
      {link ? (
        <p className="break-all text-sm">
          Link khách tự đóng:{" "}
          <Link className="font-semibold text-[#0F4C5C]" href={link}>
            {link}
          </Link>
        </p>
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
            const result = await collectPaymentAction({
              vehicleId,
              method,
              months,
              imageUrl,
            });
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
