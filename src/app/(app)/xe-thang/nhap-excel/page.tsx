import { AppShell } from "@/components/layout/AppShell";
import { ExcelImport } from "@/components/vehicles/ExcelImport";
import { getTenantContext } from "@/lib/session";
import { canEditVehicle } from "@/lib/rbac";
import { redirect } from "next/navigation";

export default async function ImportPage() {
  const { user } = await getTenantContext();
  if (!canEditVehicle(user.role)) {
    redirect("/xe-thang");
  }
  return (
    <AppShell title="Nhập Excel">
      <ExcelImport />
    </AppShell>
  );
}
