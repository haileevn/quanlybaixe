import { AppShell } from "@/components/layout/AppShell";
import { CollectTargetButton } from "@/components/modules/CollectTargetButton";
import { ServiceDesk } from "@/components/modules/ServiceChargeForms";
import { requireEnabledModule } from "@/lib/session";
import { canCollect } from "@/lib/rbac";
import { listServiceSubs, listServiceTypes } from "@/services/extra.service";
import { toNumber } from "@/lib/money";
import { DueBadge } from "@/components/vehicles/DueBadge";

export default async function ServicesPage() {
  const { db, user } = await requireEnabledModule("dichVu");
  const types = await listServiceTypes(db);
  const subs = await listServiceSubs(db);
  return (
    <AppShell title="Dịch vụ khác">
      <ServiceDesk
        types={types.map((t) => ({
          id: t.id,
          name: t.name,
          unitPrice: toNumber(t.unitPrice),
          unit: t.unit,
          cycle: t.cycle,
        }))}
      />
      <ul className="mt-5 space-y-3">
        {subs.map((row) => (
          <li key={row.id} className="space-y-3 rounded-2xl bg-white p-4">
            <p className="text-xl font-black">{row.serviceType.name}</p>
            <p>{row.customer.name} · {row.customer.phone}</p>
            {row.nextDueDate ? <DueBadge date={row.nextDueDate} amount={toNumber(row.price)} /> : null}
            {canCollect(user.role) ? (
              <CollectTargetButton
                label={row.serviceType.name}
                subscriptionId={row.id}
                amount={toNumber(row.price)}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
