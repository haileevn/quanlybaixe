import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { CollectTargetButton } from "@/components/modules/CollectTargetButton";
import { SendSmsButton } from "@/components/finance/SendSmsButton";
import { EndRentButton, RentForm, RoomForm } from "@/components/modules/RoomForms";
import { UtilityForm } from "@/components/modules/KioskUtilityForms";
import { DueBadge } from "@/components/vehicles/DueBadge";
import { requireEnabledModule } from "@/lib/session";
import { canCollect, canDelete, canEditVehicle, canSendSms } from "@/lib/rbac";
import { getRoom, roomStatusLabel } from "@/services/room.service";
import { toNumber } from "@/lib/money";
import { defaultCustomerSms } from "@/services/reminder.service";

export default async function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, user } = await requireEnabledModule("phongTro");
  try {
    const room = await getRoom(db, id);
    const contract = room.contracts.find((c) => c.status === "DANG_GUI") ?? room.contracts[0];
    return (
      <AppShell title={`Phòng ${room.code}`}>
        <p className="mb-4 text-base">{roomStatusLabel(room.status)}</p>
        {contract?.status === "DANG_GUI" ? (
          <>
            <div className="mb-4 rounded-2xl bg-white p-4">
              <p className="text-lg font-bold">{contract.customer.name}</p>
              <p>{contract.customer.phone}</p>
              <DueBadge date={contract.nextDueDate} amount={toNumber(contract.monthlyPrice)} />
            </div>
            {canCollect(user.role) ? (
              <div className="mb-4">
                <CollectTargetButton
                  label={room.code}
                  roomId={room.id}
                  amount={toNumber(contract.monthlyPrice)}
                />
              </div>
            ) : null}
            {canSendSms(user.role) ? (
              <div className="mb-4">
                <SendSmsButton
                  phone={contract.customer.phone}
                  defaultMessage={defaultCustomerSms({
                    customerName: contract.customer.name,
                    label: `phòng ${room.code}`,
                    amount: toNumber(contract.monthlyPrice),
                    nextDueDate: contract.nextDueDate,
                  })}
                />
              </div>
            ) : null}
            {canCollect(user.role) ? (
              <div className="mb-4">
                <UtilityForm roomId={room.id} />
              </div>
            ) : null}
            {canEditVehicle(user.role) ? (
              <div className="mb-6">
                <EndRentButton kind="room" targetId={room.id} />
              </div>
            ) : null}
          </>
        ) : canEditVehicle(user.role) ? (
          <div className="mb-6">
            <RentForm kind="room" targetId={room.id} />
          </div>
        ) : null}
        {canEditVehicle(user.role) ? (
          <RoomForm
            roomId={room.id}
            canDelete={canDelete(user.role)}
            initial={{
              code: room.code,
              areaM2: room.areaM2 ? toNumber(room.areaM2) : 0,
              monthlyPrice: toNumber(room.monthlyPrice),
              deposit: toNumber(room.deposit),
              note: room.note ?? "",
            }}
          />
        ) : null}
      </AppShell>
    );
  } catch {
    notFound();
  }
}
