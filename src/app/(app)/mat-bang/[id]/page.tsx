import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { CollectTargetButton } from "@/components/modules/CollectTargetButton";
import { SendSmsButton } from "@/components/finance/SendSmsButton";
import { EndRentButton, RentForm } from "@/components/modules/RoomForms";
import { KioskForm } from "@/components/modules/KioskUtilityForms";
import { DueBadge } from "@/components/vehicles/DueBadge";
import { requireEnabledModule } from "@/lib/session";
import { canCollect, canDelete, canEditVehicle, canSendSms } from "@/lib/rbac";
import { getKiosk } from "@/services/kiosk.service";
import { toNumber } from "@/lib/money";
import { defaultCustomerSms } from "@/services/reminder.service";

export default async function KioskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, user } = await requireEnabledModule("matBang");
  try {
    const kiosk = await getKiosk(db, id);
    const contract = kiosk.contracts.find((c) => c.status === "DANG_GUI") ?? kiosk.contracts[0];
    return (
      <AppShell title={`Ô ${kiosk.code}`}>
        {contract?.status === "DANG_GUI" ? (
          <>
            <div className="mb-4 rounded-2xl bg-white p-4">
              <p className="text-lg font-bold">{contract.customer.name}</p>
              <p>{contract.customer.phone}</p>
              {contract.businessType ? <p>{contract.businessType}</p> : null}
              <DueBadge date={contract.nextDueDate} amount={toNumber(contract.monthlyPrice)} />
            </div>
            {canCollect(user.role) ? (
              <div className="mb-4">
                <CollectTargetButton
                  label={kiosk.code}
                  kioskId={kiosk.id}
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
                    label: `ô ${kiosk.code}`,
                    amount: toNumber(contract.monthlyPrice),
                    nextDueDate: contract.nextDueDate,
                  })}
                />
              </div>
            ) : null}
            {canEditVehicle(user.role) ? (
              <div className="mb-6">
                <EndRentButton kind="kiosk" targetId={kiosk.id} />
              </div>
            ) : null}
          </>
        ) : canEditVehicle(user.role) ? (
          <div className="mb-6">
            <RentForm kind="kiosk" targetId={kiosk.id} />
          </div>
        ) : null}
        {canEditVehicle(user.role) ? (
          <KioskForm
            kioskId={kiosk.id}
            canDelete={canDelete(user.role)}
            initial={{
              code: kiosk.code,
              location: kiosk.location ?? "",
              areaM2: kiosk.areaM2 ? toNumber(kiosk.areaM2) : 0,
              monthlyPrice: toNumber(kiosk.monthlyPrice),
            }}
          />
        ) : null}
      </AppShell>
    );
  } catch {
    notFound();
  }
}
