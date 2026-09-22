"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Camera, RefreshCw } from "lucide-react";
import { MoneyInput } from "@/components/money/MoneyInput";
import { PlanLimitDialog } from "@/components/layout/PlanLimitDialog";
import { ConfirmDelete } from "@/components/layout/ConfirmDelete";
import { Button } from "@/components/ui/button";
import { createVehicleAction, deleteVehicleAction, updateVehicleAction } from "@/actions/vehicles";
import { VEHICLE_TYPE_LABEL } from "@/lib/plate";
import { cn, touchBtnClass, touchInputClass } from "@/lib/utils";

const types = Object.entries(VEHICLE_TYPE_LABEL) as [keyof typeof VEHICLE_TYPE_LABEL, string][];

export type VehicleFormValues = {
  plateNumber: string;
  vehicleType: keyof typeof VEHICLE_TYPE_LABEL;
  ownerName: string;
  phone: string;
  roomOrAddress: string;
  note: string;
  monthlyPrice: number;
  startDate: string;
  cycle: "THANG" | "QUY";
  status: "DANG_GUI" | "TAM_NGUNG" | "DA_NGHI";
  imageUrl: string;
};

const empty: VehicleFormValues = {
  plateNumber: "",
  vehicleType: "XE_MAY",
  ownerName: "",
  phone: "",
  roomOrAddress: "",
  note: "",
  monthlyPrice: 150000,
  startDate: new Date().toISOString().slice(0, 10),
  cycle: "THANG",
  status: "DANG_GUI",
  imageUrl: "",
};

export function VehicleForm({
  vehicleId,
  initial,
  canDelete,
  canEditPrice,
}: {
  vehicleId?: string;
  initial?: Partial<VehicleFormValues>;
  canDelete?: boolean;
  canEditPrice?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [values, setValues] = useState<VehicleFormValues>({ ...empty, ...initial });
  const [limitOpen, setLimitOpen] = useState(false);
  const [limitMessage, setLimitMessage] = useState("");

  function set<K extends keyof VehicleFormValues>(key: K, value: VehicleFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function upload(file: File) {
    setIsUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = (await res.json()) as { url?: string; message?: string };
      if (!res.ok || !json.url) {
        toast.error(json.message ?? "Không tải được ảnh.");
        return;
      }
      set("imageUrl", json.url);
      toast.success("Đã tải ảnh lên thành công.");
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi tải ảnh lên.");
    } finally {
      setIsUploading(false);
    }
  }

  function submit() {
    start(async () => {
      const payload = {
        ...values,
        roomOrAddress: values.roomOrAddress || undefined,
        note: values.note || undefined,
        imageUrl: values.imageUrl || undefined,
      };
      const result = vehicleId
        ? await updateVehicleAction(vehicleId, payload)
        : await createVehicleAction(payload);
      if (!result.ok) {
        if (result.code === "PLAN_LIMIT") {
          setLimitMessage(result.message);
          setLimitOpen(true);
          return;
        }
        toast.error(result.message);
        return;
      }
      toast.success(vehicleId ? "Đã lưu xe." : "Đã thêm xe.");
      if (!vehicleId && result.data?.id) {
        router.push(`/xe-thang/${result.data.id}`);
      } else {
        router.push("/xe-thang");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <label className="block space-y-2">
        <span className="text-base font-semibold">Biển số</span>
        <input
          className={cn(touchInputClass, "uppercase")}
          value={values.plateNumber}
          onChange={(e) => set("plateNumber", e.target.value)}
          placeholder="59H1-234.56"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-base font-semibold">Loại xe</span>
        <select
          className={touchInputClass}
          value={values.vehicleType}
          onChange={(e) => set("vehicleType", e.target.value as VehicleFormValues["vehicleType"])}
        >
          {types.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-[#0F4C5C]/10">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold flex items-center gap-1.5 text-[#0F4C5C]">
            Ảnh nhận diện xe (màu sắc & đặc điểm)
          </span>
          {values.imageUrl ? (
            <button
              type="button"
              onClick={() => set("imageUrl", "")}
              className="text-xs text-red-600 font-semibold hover:underline"
            >
              Xoá ảnh
            </button>
          ) : null}
        </div>
        <p className="text-xs text-neutral-500">
          Chụp ảnh xe rõ màu sơn, góc nhìn và đặc điểm để dễ dàng nhận diện khi xe vào/ra bãi.
        </p>

        {values.imageUrl ? (
          <div className="relative overflow-hidden rounded-xl ring-1 ring-neutral-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={values.imageUrl}
              alt="Xe"
              className="h-48 w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = "none";
              }}
            />
          </div>
        ) : null}

        <label
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#0F4C5C]/30 bg-[#0F4C5C]/5 py-3.5 text-sm font-bold text-[#0F4C5C] hover:bg-[#0F4C5C]/10 transition ${
            isUploading ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          {isUploading ? (
            <>
              <RefreshCw className="size-4 animate-spin text-[#0F4C5C]" />
              <span>Đang tải ảnh lên...</span>
            </>
          ) : (
            <>
              <Camera className="size-4" />
              <span>{values.imageUrl ? "Chụp lại / Đổi ảnh khác" : "Chụp ảnh xe ngay (Camera)"}</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-base font-semibold">Tên chủ xe</span>
        <input
          className={touchInputClass}
          value={values.ownerName}
          onChange={(e) => set("ownerName", e.target.value)}
        />
      </label>

      <label className="block space-y-2">
        <span className="text-base font-semibold">Số điện thoại</span>
        <input
          className={touchInputClass}
          inputMode="tel"
          value={values.phone}
          onChange={(e) => set("phone", e.target.value)}
        />
      </label>

      <label className="block space-y-2">
        <span className="text-base font-semibold">Phòng / địa chỉ</span>
        <input
          className={touchInputClass}
          value={values.roomOrAddress}
          onChange={(e) => set("roomOrAddress", e.target.value)}
        />
      </label>

      <label className="block space-y-2">
        <span className="text-base font-semibold">Giá một tháng</span>
        <MoneyInput
          name="monthlyPrice"
          value={values.monthlyPrice}
          disabled={!canEditPrice}
          onValueChange={(value) => set("monthlyPrice", value)}
        />
      </label>

      <label className="block space-y-2">
        <span className="text-base font-semibold">Ngày bắt đầu</span>
        <input
          type="date"
          className={touchInputClass}
          value={values.startDate.slice(0, 10)}
          onChange={(e) => set("startDate", e.target.value)}
        />
      </label>

      <label className="block space-y-2">
        <span className="text-base font-semibold">Chu kỳ đóng tiền</span>
        <select
          className={touchInputClass}
          value={values.cycle}
          onChange={(e) => set("cycle", e.target.value as VehicleFormValues["cycle"])}
        >
          <option value="THANG">Theo tháng</option>
          <option value="QUY">Theo quý</option>
        </select>
      </label>

      {vehicleId ? (
        <label className="block space-y-2">
          <span className="text-base font-semibold">Trạng thái</span>
          <select
            className={touchInputClass}
            value={values.status}
            onChange={(e) => set("status", e.target.value as VehicleFormValues["status"])}
          >
            <option value="DANG_GUI">Đang gửi</option>
            <option value="TAM_NGUNG">Tạm ngưng</option>
            <option value="DA_NGHI">Đã nghỉ</option>
          </select>
        </label>
      ) : null}

      <label className="block space-y-2">
        <span className="text-base font-semibold">Ghi chú</span>
        <textarea
          className={cn(touchInputClass, "h-24 py-3")}
          value={values.note}
          onChange={(e) => set("note", e.target.value)}
        />
      </label>

      <Button className={touchBtnClass} disabled={pending} onClick={submit}>
        {pending ? "Đang lưu..." : vehicleId ? "Lưu thay đổi" : "Thêm xe"}
      </Button>

      {vehicleId && canDelete ? (
        <ConfirmDelete
          title="Xoá xe này?"
          description="Xe sẽ được cất 30 ngày, bấm khôi phục trong Cài đặt nếu xoá nhầm."
          onConfirm={async () => {
            const result = await deleteVehicleAction(vehicleId);
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success("Đã xoá xe.");
            router.push("/xe-thang");
            router.refresh();
          }}
        />
      ) : null}

      <PlanLimitDialog open={limitOpen} message={limitMessage} onOpenChange={setLimitOpen} />
    </div>
  );
}
