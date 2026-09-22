"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { collectUtilityAction, createKioskAction, deleteKioskAction, updateKioskAction } from "@/actions/modules";
import { MoneyInput } from "@/components/money/MoneyInput";
import { ConfirmDelete } from "@/components/layout/ConfirmDelete";
import { Button } from "@/components/ui/button";
import { nowVn } from "@/lib/datetime";
import { touchBtnClass, touchInputClass } from "@/lib/utils";

export function KioskForm({
  kioskId,
  initial,
  canDelete,
}: {
  kioskId?: string;
  canDelete?: boolean;
  initial?: { code: string; location?: string; areaM2?: number; monthlyPrice: number };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState(initial?.code ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [areaM2, setAreaM2] = useState(initial?.areaM2 ?? 0);
  const [monthlyPrice, setMonthlyPrice] = useState(initial?.monthlyPrice ?? 3000000);

  return (
    <div className="space-y-4">
      <label className="block space-y-2">
        <span className="text-base font-semibold">Mã ô / ki-ốt</span>
        <input className={touchInputClass} value={code} onChange={(e) => setCode(e.target.value)} />
      </label>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Vị trí</span>
        <input className={touchInputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
      </label>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Diện tích (m²)</span>
        <input
          className={touchInputClass}
          inputMode="decimal"
          value={areaM2 || ""}
          onChange={(e) => setAreaM2(Number(e.target.value) || 0)}
        />
      </label>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Giá thuê tháng</span>
        <MoneyInput name="kioskPrice" value={monthlyPrice} onValueChange={setMonthlyPrice} />
      </label>
      <Button
        className={touchBtnClass}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const payload = { code, location, areaM2: areaM2 || undefined, monthlyPrice };
            const result = kioskId ? await updateKioskAction(kioskId, payload) : await createKioskAction(payload);
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success(kioskId ? "Đã lưu mặt bằng." : "Đã thêm mặt bằng.");
            if (kioskId) router.push(`/mat-bang/${kioskId}`);
            else if (result.data?.id) router.push(`/mat-bang/${result.data.id}`);
            router.refresh();
          })
        }
      >
        {pending ? "Đang lưu..." : "Lưu"}
      </Button>
      {kioskId && canDelete ? (
        <ConfirmDelete
          title="Xoá mặt bằng này?"
          description="Ô sẽ vào thùng rác 30 ngày."
          onConfirm={async () => {
            const result = await deleteKioskAction(kioskId);
            if (!result.ok) toast.error(result.message);
            else {
              toast.success("Đã xoá.");
              router.push("/mat-bang");
              router.refresh();
            }
          }}
        />
      ) : null}
    </div>
  );
}

export function UtilityForm({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [periodYm, setPeriodYm] = useState(nowVn().format("YYYY-MM"));
  const [oldElectric, setOldElectric] = useState(0);
  const [newElectric, setNewElectric] = useState(0);
  const [oldWater, setOldWater] = useState(0);
  const [newWater, setNewWater] = useState(0);
  const [electricPrice, setElectricPrice] = useState(3500);
  const [waterPrice, setWaterPrice] = useState(15000);
  const [trashFee, setTrashFee] = useState(30000);
  const [otherFee, setOtherFee] = useState(0);
  const [method, setMethod] = useState<"TIEN_MAT" | "CHUYEN_KHOAN">("TIEN_MAT");

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4">
      <p className="text-lg font-bold">Thu điện nước</p>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Kỳ (năm-tháng)</span>
        <input className={touchInputClass} value={periodYm} onChange={(e) => setPeriodYm(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-sm font-semibold">Điện cũ</span>
          <input className={touchInputClass} inputMode="numeric" value={oldElectric || ""} onChange={(e) => setOldElectric(Number(e.target.value) || 0)} />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-semibold">Điện mới</span>
          <input className={touchInputClass} inputMode="numeric" value={newElectric || ""} onChange={(e) => setNewElectric(Number(e.target.value) || 0)} />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-semibold">Nước cũ</span>
          <input className={touchInputClass} inputMode="numeric" value={oldWater || ""} onChange={(e) => setOldWater(Number(e.target.value) || 0)} />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-semibold">Nước mới</span>
          <input className={touchInputClass} inputMode="numeric" value={newWater || ""} onChange={(e) => setNewWater(Number(e.target.value) || 0)} />
        </label>
      </div>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Giá điện / số</span>
        <MoneyInput name="electricPrice" value={electricPrice} onValueChange={setElectricPrice} />
      </label>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Giá nước / khối</span>
        <MoneyInput name="waterPrice" value={waterPrice} onValueChange={setWaterPrice} />
      </label>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Tiền rác</span>
        <MoneyInput name="trashFee" value={trashFee} onValueChange={setTrashFee} />
      </label>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Khoản khác</span>
        <MoneyInput name="otherFee" value={otherFee} onValueChange={setOtherFee} />
      </label>
      <select className={touchInputClass} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
        <option value="TIEN_MAT">Tiền mặt</option>
        <option value="CHUYEN_KHOAN">Chuyển khoản</option>
      </select>
      <Button
        className={touchBtnClass}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await collectUtilityAction({
              roomId,
              periodYm,
              oldElectric,
              newElectric,
              oldWater,
              newWater,
              electricPrice,
              waterPrice,
              trashFee,
              otherFee,
              method,
            });
            if (!result.ok) toast.error(result.message);
            else {
              toast.success(`Đã thu điện nước ${result.data.amountLabel}.`);
              router.refresh();
            }
          })
        }
      >
        {pending ? "Đang thu..." : "Thu điện nước"}
      </Button>
    </div>
  );
}
