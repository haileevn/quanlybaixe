import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { DueBadge } from "@/components/vehicles/DueBadge";
import { CollectButton } from "@/components/vehicles/CollectButton";
import { CollectTargetButton } from "@/components/modules/CollectTargetButton";
import { SendSmsButton } from "@/components/finance/SendSmsButton";
import { getTenantContext } from "@/lib/session";
import { dueItemHref, listDebts } from "@/services/due.service";
import { defaultCustomerSms } from "@/services/reminder.service";
import { canCollect, canSendSms } from "@/lib/rbac";
import { formatVnd } from "@/lib/money";

export default async function DebtPage() {
  const { db, user } = await getTenantContext();
  const rows = await listDebts(db);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <AppShell title="Công nợ">
      <p className="mb-4 text-lg font-bold">Tổng đang nợ: {formatVnd(total)}</p>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.targetId} className="space-y-3 rounded-2xl bg-white p-4">
            <Link href={dueItemHref(row)}>
              <p className="text-sm font-semibold text-amber-800">{row.sourceLabel}</p>
              <p className="text-2xl font-black">{row.label}</p>
              <p className="text-base">{row.customerName} · {row.phone}</p>
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
        <p className="rounded-2xl bg-white p-6 text-center">Không ai đang nợ.</p>
      ) : null}
    </AppShell>
  );
}
