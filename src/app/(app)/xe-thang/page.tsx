import Link from "next/link";
import { Camera } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { VehicleSearch } from "@/components/vehicles/VehicleSearch";
import { getTenantContext } from "@/lib/session";
import { listVehicles } from "@/services/vehicle.service";
import { toNumber } from "@/lib/money";
import { canEditVehicle } from "@/lib/rbac";

export default async function VehiclesPage() {
  const { db, user } = await getTenantContext();
  const rows = await listVehicles(db, { take: 80 });
  const initial = rows.map((row) => ({
    id: row.id,
    plateNumber: row.plateNumber,
    vehicleType: row.vehicleType,
    ownerName: row.customer.name,
    phone: row.customer.phone,
    monthlyPrice: row.contracts[0] ? toNumber(row.contracts[0].monthlyPrice) : 0,
    nextDueDate: row.contracts[0]?.nextDueDate ?? null,
    status: row.contracts[0]?.status ?? "DANG_GUI",
  }));

  return (
    <AppShell
      title="Xe tháng"
      action={
        <div className="flex items-center gap-2">
          <Link
            href="/quet-bien-so"
            className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-2 text-sm font-bold text-white hover:bg-white/30 transition"
          >
            <Camera className="size-4 text-amber-300" />
            Quét
          </Link>
          {canEditVehicle(user.role) ? (
            <Link
              href="/xe-thang/them"
              className="rounded-full bg-amber-400 px-3 py-2 text-sm font-bold text-[#0F4C5C] hover:bg-amber-300 transition"
            >
              Thêm xe
            </Link>
          ) : null}
        </div>
      }
    >
      <div className="mb-4 flex items-center justify-between">
        {canEditVehicle(user.role) ? (
          <Link href="/xe-thang/nhap-excel" className="text-sm font-semibold text-[#0F4C5C] hover:underline">
            Nhập từ Excel
          </Link>
        ) : <span />}
        <Link
          href="/quet-bien-so"
          className="flex items-center gap-1.5 text-sm font-bold text-[#0F4C5C] bg-amber-400/20 px-3 py-1.5 rounded-full hover:bg-amber-400/30 transition"
        >
          <Camera className="size-4" />
          Quét biển số (Xử lý ảnh)
        </Link>
      </div>
      <VehicleSearch initial={initial} />
    </AppShell>
  );
}
