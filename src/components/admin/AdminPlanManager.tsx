"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveAddonAction, savePlanAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";
import { touchBtnClass, touchInputClass } from "@/lib/utils";
import { ScanLine } from "lucide-react";

type PlanRow = {
  id: string;
  code: string;
  name: string;
  monthlyPrice: number;
  maxVehicles: number;
  maxStaff: number;
  maxBranches: number;
  maxDailyScans: number;
  maxMonthlyScans: number;
};

type AddonRow = {
  id: string;
  code: string;
  name: string;
  monthlyPrice: number;
  isActive: boolean;
};

function PlanCard({ plan }: { plan: PlanRow }) {
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(String(plan.monthlyPrice));
  const [vehicles, setVehicles] = useState(String(plan.maxVehicles));
  const [staff, setStaff] = useState(String(plan.maxStaff));
  const [branches, setBranches] = useState(String(plan.maxBranches));
  const [dailyScans, setDailyScans] = useState(String(plan.maxDailyScans ?? -1));
  const [monthlyScans, setMonthlyScans] = useState(String(plan.maxMonthlyScans ?? -1));
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm border border-neutral-200/80">
      <div className="flex items-center justify-between">
        <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-mono text-neutral-600">
          {plan.code}
        </span>
        {plan.code === "DUNG_THU" && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
            Gói Dùng Thử
          </span>
        )}
      </div>

      <label className="block text-xs font-semibold text-neutral-700">
        Tên gói
        <input className={touchInputClass + " mt-1"} value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="block text-xs font-semibold text-neutral-700">
        Giá tháng (VNĐ)
        <input className={touchInputClass + " mt-1"} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
      </label>

      <div>
        <label className="block text-xs font-semibold text-neutral-700 mb-1">
          Hạn mức: Xe · Nhân viên · Bãi xe (−1 = không giới hạn)
        </label>
        <div className="grid grid-cols-3 gap-2">
          <input className={touchInputClass} value={vehicles} title="Số xe tối đa" onChange={(e) => setVehicles(e.target.value)} />
          <input className={touchInputClass} value={staff} title="Số nhân viên tối đa" onChange={(e) => setStaff(e.target.value)} />
          <input className={touchInputClass} value={branches} title="Số bãi tối đa" onChange={(e) => setBranches(e.target.value)} />
        </div>
      </div>

      <div className="rounded-xl bg-amber-50/70 border border-amber-200/60 p-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 mb-1.5">
          <ScanLine className="h-3.5 w-3.5 text-amber-700" />
          <span>Giới hạn quét biển số (−1 = không giới hạn)</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-amber-800">
            Lượt/ngày
            <input
              className={touchInputClass + " mt-1 bg-white"}
              value={dailyScans}
              onChange={(e) => setDailyScans(e.target.value)}
              placeholder="VD: 5"
            />
          </label>
          <label className="text-xs text-amber-800">
            Lượt/tháng
            <input
              className={touchInputClass + " mt-1 bg-white"}
              value={monthlyScans}
              onChange={(e) => setMonthlyScans(e.target.value)}
              placeholder="VD: 30"
            />
          </label>
        </div>
      </div>

      <Button
        className={touchBtnClass}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await savePlanAction({
              id: plan.id,
              name,
              monthlyPrice: Number(price.replace(/\D/g, "")) || 0,
              maxVehicles: Number(vehicles) || 0,
              maxStaff: Number(staff) || 0,
              maxBranches: Number(branches) || 0,
              maxDailyScans: Number(dailyScans) || -1,
              maxMonthlyScans: Number(monthlyScans) || -1,
            });
            if (!result.ok) toast.error(result.message || "Lỗi khi lưu gói");
            else toast.success(`Đã lưu ${name} (${formatVnd(Number(price.replace(/\D/g, "")) || 0)}).`);
          })
        }
      >
        Lưu cấu hình gói
      </Button>
    </div>
  );
}

function AddonCard({ addon }: { addon: AddonRow }) {
  const [name, setName] = useState(addon.name);
  const [price, setPrice] = useState(String(addon.monthlyPrice));
  const [active, setActive] = useState(addon.isActive);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm border border-neutral-200/80">
      <input className={touchInputClass} value={name} onChange={(e) => setName(e.target.value)} />
      <input className={touchInputClass} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
      <label className="flex items-center gap-2 text-base">
        <input type="checkbox" className="size-5" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Đang bán
      </label>
      <Button
        className={touchBtnClass}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await saveAddonAction({
              id: addon.id,
              name,
              monthlyPrice: Number(price.replace(/\D/g, "")) || 0,
              isActive: active,
            });
            if (!result.ok) toast.error(result.message || "Lỗi khi lưu dịch vụ");
            else toast.success("Đã lưu dịch vụ thêm.");
          })
        }
      >
        Lưu
      </Button>
    </div>
  );
}

export function AdminPlanManager({ plans, addons }: { plans: PlanRow[]; addons: AddonRow[] }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-neutral-900">Quản lý gói dịch vụ</h2>
        <p className="text-xs text-neutral-600">
          Tùy chỉnh giá, số lượng xe, nhân viên và hạn mức quét biển số cho từng gói.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-bold text-neutral-700">Danh sách gói chính</p>
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </div>

      <div className="space-y-3 pt-2">
        <p className="text-sm font-bold text-neutral-700">Dịch vụ bổ sung (Addon)</p>
        {addons.map((addon) => (
          <AddonCard key={addon.id} addon={addon} />
        ))}
      </div>
    </div>
  );
}
