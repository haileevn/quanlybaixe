import { AppShell } from "@/components/layout/AppShell";
import { KioskForm } from "@/components/modules/KioskUtilityForms";
import { requireEnabledModule } from "@/lib/session";
import { canEditVehicle } from "@/lib/rbac";
import { redirect } from "next/navigation";

export default async function NewKioskPage() {
  const { user } = await requireEnabledModule("matBang");
  if (!canEditVehicle(user.role)) redirect("/mat-bang");
  return (
    <AppShell title="Thêm mặt bằng">
      <KioskForm />
    </AppShell>
  );
}
