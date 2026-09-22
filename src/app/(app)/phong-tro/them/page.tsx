import { AppShell } from "@/components/layout/AppShell";
import { RoomForm } from "@/components/modules/RoomForms";
import { requireEnabledModule } from "@/lib/session";
import { canEditVehicle } from "@/lib/rbac";
import { redirect } from "next/navigation";

export default async function NewRoomPage() {
  const { user } = await requireEnabledModule("phongTro");
  if (!canEditVehicle(user.role)) redirect("/phong-tro");
  return (
    <AppShell title="Thêm phòng">
      <RoomForm />
    </AppShell>
  );
}
