import { AppShell } from "@/components/layout/AppShell";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { getTenantContext } from "@/lib/session";
import { canEditVehicle } from "@/lib/rbac";
import { redirect } from "next/navigation";

export default async function NewVehiclePage({
  searchParams,
}: {
  searchParams: Promise<{ plate?: string; imageUrl?: string }>;
}) {
  const { user } = await getTenantContext();
  if (!canEditVehicle(user.role)) {
    redirect("/xe-thang");
  }
  const { plate, imageUrl } = await searchParams;

  return (
    <AppShell title="Thêm xe">
      <VehicleForm
        canEditPrice
        canDelete={false}
        initial={{
          plateNumber: plate ?? "",
          imageUrl: imageUrl ?? "",
        }}
      />
    </AppShell>
  );
}
