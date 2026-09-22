"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { recordExpenseAction, recordWalkInAction } from "@/actions/cash";
import { MoneyInput } from "@/components/money/MoneyInput";
import { Button } from "@/components/ui/button";
import { touchBtnClass, touchInputClass } from "@/lib/utils";

export function CashForm({
  kind,
  categories,
}: {
  kind: "THU" | "CHI";
  categories?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<"TIEN_MAT" | "CHUYEN_KHOAN">("TIEN_MAT");
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState(categories?.[0]?.id ?? "");
  const [imageUrl, setImageUrl] = useState("");
  const [pending, start] = useTransition();

  async function upload(file: File) {
    const body = new FormData();
    body.set("file", file);
    const res = await fetch("/api/upload", { method: "POST", body });
    const json = (await res.json()) as { url?: string; message?: string };
    if (!res.ok || !json.url) {
      toast.error(json.message ?? "Không tải được ảnh.");
      return;
    }
    setImageUrl(json.url);
  }

  return (
    <div className="space-y-4">
      <label className="block space-y-2">
        <span className="text-base font-semibold">Số tiền</span>
        <MoneyInput name="amount" value={amount} onValueChange={setAmount} />
      </label>
      {kind === "CHI" && categories ? (
        <label className="block space-y-2">
          <span className="text-base font-semibold">Loại chi</span>
          <select
            className={touchInputClass}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="block space-y-2">
        <span className="text-base font-semibold">Cách nhận / trả</span>
        <select
          className={touchInputClass}
          value={method}
          onChange={(e) => setMethod(e.target.value as typeof method)}
        >
          <option value="TIEN_MAT">Tiền mặt</option>
          <option value="CHUYEN_KHOAN">Chuyển khoản</option>
        </select>
      </label>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Ghi chú</span>
        <input className={touchInputClass} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Ảnh chứng từ (nếu có)</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </label>
      <Button
        className={touchBtnClass}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const payload = { amount, method, note, imageUrl, expenseCategoryId: categoryId };
            const result =
              kind === "THU" ? await recordWalkInAction(payload) : await recordExpenseAction(payload);
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success(kind === "THU" ? "Đã ghi khoản thu." : "Đã ghi khoản chi.");
            router.push("/thu-chi");
            router.refresh();
          })
        }
      >
        {pending ? "Đang lưu..." : "Lưu"}
      </Button>
    </div>
  );
}
