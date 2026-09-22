"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createRoomAction,
  deleteRoomAction,
  endKioskAction,
  endRoomAction,
  rentKioskAction,
  rentRoomAction,
  updateRoomAction,
} from "@/actions/modules";
import { MoneyInput } from "@/components/money/MoneyInput";
import { ConfirmDelete } from "@/components/layout/ConfirmDelete";
import { Button } from "@/components/ui/button";
import { touchBtnClass, touchInputClass } from "@/lib/utils";

export function RoomForm({
  roomId,
  initial,
  canDelete,
}: {
  roomId?: string;
  canDelete?: boolean;
  initial?: { code: string; areaM2?: number; monthlyPrice: number; deposit: number; note: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState(initial?.code ?? "");
  const [areaM2, setAreaM2] = useState(initial?.areaM2 ?? 0);
  const [monthlyPrice, setMonthlyPrice] = useState(initial?.monthlyPrice ?? 2500000);
  const [deposit, setDeposit] = useState(initial?.deposit ?? 0);
  const [note, setNote] = useState(initial?.note ?? "");

  return (
    <div className="space-y-4">
      <label className="block space-y-2">
        <span className="text-base font-semibold">Mã phòng</span>
        <input className={touchInputClass} value={code} onChange={(e) => setCode(e.target.value)} />
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
        <MoneyInput name="monthlyPrice" value={monthlyPrice} onValueChange={setMonthlyPrice} />
      </label>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Tiền cọc</span>
        <MoneyInput name="deposit" value={deposit} onValueChange={setDeposit} />
      </label>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Ghi chú</span>
        <input className={touchInputClass} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <Button
        className={touchBtnClass}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const payload = { code, areaM2: areaM2 || undefined, monthlyPrice, deposit, note };
            const result = roomId
              ? await updateRoomAction(roomId, payload)
              : await createRoomAction(payload);
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success(roomId ? "Đã lưu phòng." : "Đã thêm phòng.");
            if (roomId) router.push(`/phong-tro/${roomId}`);
            else if (result.data?.id) router.push(`/phong-tro/${result.data.id}`);
            router.refresh();
          })
        }
      >
        {pending ? "Đang lưu..." : "Lưu"}
      </Button>
      {roomId && canDelete ? (
        <ConfirmDelete
          title="Xoá phòng này?"
          description="Phòng sẽ vào thùng rác 30 ngày."
          onConfirm={async () => {
            const result = await deleteRoomAction(roomId);
            if (!result.ok) toast.error(result.message);
            else {
              toast.success("Đã xoá phòng.");
              router.push("/phong-tro");
              router.refresh();
            }
          }}
        />
      ) : null}
    </div>
  );
}

export function RentForm({
  kind,
  targetId,
}: {
  kind: "room" | "kiosk";
  targetId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState(2500000);
  const [deposit, setDeposit] = useState(0);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [cycle, setCycle] = useState<"THANG" | "QUY">("THANG");
  const [businessType, setBusinessType] = useState("");

  return (
    <div className="space-y-4 rounded-2xl bg-white p-4">
      <p className="text-lg font-bold">Cho thuê</p>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Tên khách</span>
        <input className={touchInputClass} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
      </label>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Số điện thoại</span>
        <input className={touchInputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      {kind === "kiosk" ? (
        <label className="block space-y-2">
          <span className="text-base font-semibold">Ngành hàng (nếu có)</span>
          <input className={touchInputClass} value={businessType} onChange={(e) => setBusinessType(e.target.value)} />
        </label>
      ) : null}
      <label className="block space-y-2">
        <span className="text-base font-semibold">Giá tháng</span>
        <MoneyInput name="rent" value={monthlyPrice} onValueChange={setMonthlyPrice} />
      </label>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Cọc</span>
        <MoneyInput name="deposit" value={deposit} onValueChange={setDeposit} />
      </label>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Ngày bắt đầu</span>
        <input className={touchInputClass} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </label>
      <select className={touchInputClass} value={cycle} onChange={(e) => setCycle(e.target.value as typeof cycle)}>
        <option value="THANG">Thu theo tháng</option>
        <option value="QUY">Thu theo quý</option>
      </select>
      <Button
        className={touchBtnClass}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const payload = { ownerName, phone, monthlyPrice, deposit, startDate, cycle, businessType };
            const result = kind === "room" ? await rentRoomAction(targetId, payload) : await rentKioskAction(targetId, payload);
            if (!result.ok) toast.error(result.message);
            else {
              toast.success("Đã cho thuê.");
              router.refresh();
            }
          })
        }
      >
        {pending ? "Đang lưu..." : "Cho thuê"}
      </Button>
    </div>
  );
}

export function EndRentButton({ kind, targetId }: { kind: "room" | "kiosk"; targetId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      className={touchBtnClass}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = kind === "room" ? await endRoomAction(targetId) : await endKioskAction(targetId);
          if (!result.ok) toast.error(result.message);
          else {
            toast.success("Đã kết thúc thuê.");
            router.refresh();
          }
        })
      }
    >
      Kết thúc thuê
    </Button>
  );
}
