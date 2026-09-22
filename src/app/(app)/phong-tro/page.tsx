import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { requireEnabledModule } from "@/lib/session";
import { listRooms, roomStatusLabel } from "@/services/room.service";
import { canEditVehicle } from "@/lib/rbac";
import { formatVnd, toNumber } from "@/lib/money";
import { DueBadge } from "@/components/vehicles/DueBadge";

export default async function RoomsPage() {
  const { db, user } = await requireEnabledModule("phongTro");
  const rows = await listRooms(db);
  return (
    <AppShell
      title="Phòng trọ"
      action={
        canEditVehicle(user.role) ? (
          <Link href="/phong-tro/them" className="rounded-full bg-amber-400 px-3 py-2 text-sm font-bold text-[#0F4C5C]">
            Thêm phòng
          </Link>
        ) : null
      }
    >
      <ul className="space-y-3">
        {rows.map((row) => {
          const contract = row.contracts[0];
          return (
            <li key={row.id}>
              <Link href={`/phong-tro/${row.id}`} className="block rounded-2xl bg-white p-4 ring-1 ring-[#0F4C5C]/10">
                <p className="text-2xl font-black">{row.code}</p>
                <p className="text-base">{roomStatusLabel(row.status)}</p>
                {contract ? (
                  <>
                    <p className="text-base">{contract.customer.name} · {contract.customer.phone}</p>
                    <DueBadge date={contract.nextDueDate} amount={toNumber(contract.monthlyPrice)} />
                  </>
                ) : (
                  <p className="text-base">{formatVnd(row.monthlyPrice)} / tháng</p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 ? <p className="rounded-2xl bg-white p-6 text-center">Chưa có phòng nào.</p> : null}
    </AppShell>
  );
}
