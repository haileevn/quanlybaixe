import { AppShell } from "@/components/layout/AppShell";
import { VehicleSearch } from "@/components/vehicles/VehicleSearch";
import { PendingProofs } from "@/components/finance/PendingProofs";
import { getTenantContext } from "@/lib/session";
import { listVehicles } from "@/services/vehicle.service";
import { listPendingProofs } from "@/services/collect.service";
import { toNumber } from "@/lib/money";

export default async function CollectPage() {
  const { db, user } = await getTenantContext();
  const [rows, proofs] = await Promise.all([listVehicles(db, { take: 40 }), listPendingProofs(user.tenantId)]);
  const initial = rows.map((row) => ({
    id: row.id,
    plateNumber: row.plateNumber,
    vehicleType: row.vehicleType,
    ownerName: row.customer.name,
    phone: row.customer.phone,
    monthlyPrice: row.contracts[0] ? toNumber(row.contracts[0].monthlyPrice) : 0,
    nextDueDate: row.contracts[0]?.nextDueDate ?? null,
    status: row.contracts[0]?.status ?? "DANG_GUI",
  }));

  return (
    <AppShell title="Thu tiền">
      <PendingProofs
        rows={proofs.map((row) => ({
          id: row.id,
          transferContent: row.transferContent,
          amount: toNumber(row.amount),
          status: row.status,
          proofImageUrl: row.proofImageUrl,
          months: row.months,
          createdAt: row.createdAt,
        }))}
      />
      <p className="mb-4 text-base text-neutral-600">Tìm xe rồi bấm vào để thu.</p>
      <VehicleSearch initial={initial} />
    </AppShell>
  );
}
