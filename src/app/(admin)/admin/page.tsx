import { formatVnd } from "@/lib/money";
import { getAdminStats } from "@/services/admin.service";
import { requireSuperAdmin } from "@/lib/session";

export default async function AdminHomePage() {
  await requireSuperAdmin();
  const stats = await getAdminStats();
  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-[#0F4C5C] p-5 text-white">
        <p className="text-sm text-amber-200">Toàn hệ thống</p>
        <p className="mt-2 text-4xl font-black">{stats.tenants}</p>
        <p className="text-base">bãi xe</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4">
          <p className="text-sm text-neutral-600">Chờ duyệt</p>
          <p className="text-3xl font-black">{stats.pending}</p>
        </div>
        <div className="rounded-2xl bg-white p-4">
          <p className="text-sm text-neutral-600">Đã thu gói</p>
          <p className="text-2xl font-black">{formatVnd(stats.revenue)}</p>
        </div>
      </div>
    </div>
  );
}
