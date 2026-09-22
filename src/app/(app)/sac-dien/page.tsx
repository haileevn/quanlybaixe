import { AppShell } from "@/components/layout/AppShell";
import { ChargingDesk } from "@/components/modules/ServiceChargeForms";
import { requireEnabledModule } from "@/lib/session";
import { chargerStatusLabel, listChargers, listChargingPlans } from "@/services/charging.service";

export default async function ChargingPage() {
  const { db } = await requireEnabledModule("sacDien");
  const chargers = await listChargers(db);
  const plans = await listChargingPlans(db);
  return (
    <AppShell title="Sạc xe điện">
      <ul className="mb-4 space-y-2">
        {chargers.map((item) => (
          <li key={item.id} className="rounded-xl bg-white p-3 font-bold">
            {item.code} · {chargerStatusLabel(item.status)}
            {item.sessions[0] ? <span className="block text-sm font-normal text-amber-800">Đang có phiên sạc</span> : null}
          </li>
        ))}
      </ul>
      <ChargingDesk
        chargers={chargers.map((c) => ({
          id: c.id,
          code: c.code,
          status: c.status,
          location: c.location,
        }))}
        plans={plans.map((p) => ({ id: p.id, name: p.name, billingType: p.billingType }))}
      />
    </AppShell>
  );
}
