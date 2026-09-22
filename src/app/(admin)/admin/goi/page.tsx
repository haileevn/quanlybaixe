import { AdminPlanManager } from "@/components/admin/AdminPlanManager";
import { toNumber } from "@/lib/money";
import { requireSuperAdmin } from "@/lib/session";
import { listAddonsForAdmin, listPlansForAdmin } from "@/services/admin.service";

export default async function AdminPlansPage() {
  await requireSuperAdmin();
  const plans = await listPlansForAdmin();
  const addons = await listAddonsForAdmin();
  return (
    <AdminPlanManager
      plans={plans.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        monthlyPrice: toNumber(row.monthlyPrice),
        maxVehicles: row.maxVehicles,
        maxStaff: row.maxStaff,
        maxBranches: row.maxBranches,
        maxDailyScans: row.maxDailyScans,
        maxMonthlyScans: row.maxMonthlyScans,
      }))}
      addons={addons.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        monthlyPrice: toNumber(row.monthlyPrice),
        isActive: row.isActive,
      }))}
    />
  );
}
