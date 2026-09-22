import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { StaffManager } from "@/components/layout/StaffManager";
import { getTenantContext } from "@/lib/session";
import { canManageStaff } from "@/lib/rbac";
import { listStaff } from "@/services/staff.service";
import { ROLE_LABEL } from "@/lib/plate";

export default async function StaffPage() {
  const { user } = await getTenantContext();
  if (!canManageStaff(user.role)) {
    redirect("/");
  }
  const rows = await listStaff(user.tenantId);
  return (
    <AppShell title="Nhân viên">
      <StaffManager
        rows={rows.map((row) => ({
          id: row.id,
          name: row.user.name,
          email: row.user.email,
          role: row.role,
          roleLabel: ROLE_LABEL[row.role],
          disabled: Boolean(row.disabledAt),
          isOwner: row.role === "OWNER",
        }))}
      />
    </AppShell>
  );
}
