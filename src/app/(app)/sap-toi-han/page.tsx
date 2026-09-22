import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { CollectButton } from "@/components/vehicles/CollectButton";
import { CollectTargetButton } from "@/components/modules/CollectTargetButton";
import { DueBadge } from "@/components/vehicles/DueBadge";
import { BulkRemind } from "@/components/finance/BulkRemind";
import { SendSmsButton } from "@/components/finance/SendSmsButton";
import { getTenantContext } from "@/lib/session";
import { dueItemHref, listDueItems } from "@/services/due.service";
import { defaultCustomerSms } from "@/services/reminder.service";
import { canCollect, canManageSettings, canSendSms } from "@/lib/rbac";
import { vnStartOfDay } from "@/lib/datetime";

export default async function UpcomingPage() {
  const { db, user } = await getTenantContext();
  const rows = await listDueItems(db, {
    from: vnStartOfDay().subtract(90, "day").toDate(),
    to: vnStartOfDay().add(14, "day").endOf("day").toDate(),
  });

  return (
    <AppShell title="Sắp tới hạn">
      <p className="mb-4 text-base text-neutral-600">Bấm Đã thu là ghi nhận xong.</p>
      {(canManageSettings(user.role) || user.role === "MANAGER") && rows.length > 0 ? (
        <div className="mb-4">
          <BulkRemind items={rows} />
        </div>
      ) : null}
      <ul className="space-y-4">
        {rows.map((row) => (
          <li key={row.targetId} className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-[#0F4C5C]/10">
            <Link href={dueItemHref(row)}>
              <p className="text-sm font-semibold text-amber-800">{row.sourceLabel}</p>
              <p className="text-2xl font-black">{row.label}</p>
              <p className="text-base">
                {row.customerName} · {row.phone}
              </p>
              <DueBadge date={row.nextDueDate} amount={row.amount} />
            </Link>
            {canCollect(user.role) && row.vehicleId ? (
              <CollectButton vehicleId={row.vehicleId} plateNumber={row.label} amount={row.amount} />
            ) : null}
            {canCollect(user.role) && row.roomId ? (
              <CollectTargetButton label={row.label} roomId={row.roomId} amount={row.amount} />
            ) : null}
            {canCollect(user.role) && row.kioskId ? (
              <CollectTargetButton label={row.label} kioskId={row.kioskId} amount={row.amount} />
            ) : null}
            {canCollect(user.role) && row.source === "DICH_VU" ? (
              <CollectTargetButton label={row.label} subscriptionId={row.targetId} amount={row.amount} />
            ) : null}
            {canSendSms(user.role) ? (
              <SendSmsButton phone={row.phone} defaultMessage={defaultCustomerSms(row)} />
            ) : null}
          </li>
        ))}
      </ul>
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center">Không có hạn nào trong khoảng này.</p>
      ) : null}
    </AppShell>
  );
}
