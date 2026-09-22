import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { CollectButton } from "@/components/vehicles/CollectButton";
import { SendSmsButton } from "@/components/finance/SendSmsButton";
import { DueBadge } from "@/components/vehicles/DueBadge";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { formatVnd, toNumber } from "@/lib/money";
import { formatVnDate, toVn } from "@/lib/datetime";
import { getTenantContext } from "@/lib/session";
import { canCollect, canDelete, canEditPrice, canEditVehicle, canSendSms, isReadOnly } from "@/lib/rbac";
import { getVehicle } from "@/services/vehicle.service";
import { listVehiclePayments } from "@/services/transaction.service";
import { defaultCustomerSms } from "@/services/reminder.service";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { db, user } = await getTenantContext();
  try {
    const vehicle = await getVehicle(db, id);
    const contract = vehicle.contracts[0];
    const payments = await listVehiclePayments(db, id);

    return (
      <AppShell title={vehicle.plateNumber}>
        {contract ? (
          <div className="mb-4 rounded-2xl bg-white p-4 ring-1 ring-[#0F4C5C]/10">
            <DueBadge date={contract.nextDueDate} amount={toNumber(contract.monthlyPrice)} />
          </div>
        ) : null}

        {canCollect(user.role) && contract?.status === "DANG_GUI" ? (
          <div className="mb-6">
            <CollectButton
              vehicleId={vehicle.id}
              plateNumber={vehicle.plateNumber}
              amount={toNumber(contract.monthlyPrice)}
            />
          </div>
        ) : null}

        {canSendSms(user.role) ? (
          <div className="mb-6">
            <SendSmsButton
              phone={vehicle.customer.phone}
              defaultMessage={
                contract
                  ? defaultCustomerSms({
                      customerName: vehicle.customer.name,
                      label: vehicle.plateNumber,
                      amount: toNumber(contract.monthlyPrice),
                      nextDueDate: contract.nextDueDate,
                    })
                  : `Chào ${vehicle.customer.name}, bãi xe xin nhắn.`
              }
            />
          </div>
        ) : null}

        <h2 className="mb-3 text-lg font-bold">Lịch sử đóng tiền</h2>
        <ul className="mb-8 space-y-2">
          {payments.length === 0 ? (
            <li className="rounded-xl bg-white p-4 text-neutral-600">Chưa có lần thu nào.</li>
          ) : (
            payments.map((inv) => (
              <li key={inv.id} className="rounded-xl bg-white p-4">
                <p className="text-lg font-bold">{formatVnd(inv.totalAmount)}</p>
                <p className="text-sm text-neutral-600">
                  {formatVnDate(inv.transactions[0]?.occurredAt ?? inv.createdAt)} ·{" "}
                  {inv.transactions[0]?.method === "CHUYEN_KHOAN" ? "Chuyển khoản" : "Tiền mặt"}
                </p>
              </li>
            ))
          )}
        </ul>

        {canEditVehicle(user.role) && !isReadOnly(user.role) ? (
          <>
            <h2 className="mb-3 text-lg font-bold">Sửa thông tin</h2>
            <VehicleForm
              vehicleId={vehicle.id}
              canDelete={canDelete(user.role)}
              canEditPrice={canEditPrice(user.role)}
              initial={{
                plateNumber: vehicle.plateNumber,
                vehicleType: vehicle.vehicleType,
                ownerName: vehicle.customer.name,
                phone: vehicle.customer.phone,
                roomOrAddress: vehicle.roomOrAddress ?? "",
                note: vehicle.note ?? "",
                monthlyPrice: contract ? toNumber(contract.monthlyPrice) : 0,
                startDate: contract ? toVn(contract.startDate).format("YYYY-MM-DD") : "",
                cycle: contract?.cycle ?? "THANG",
                status: contract?.status ?? "DANG_GUI",
                imageUrl: vehicle.imageUrl ?? "",
              }}
            />
          </>
        ) : null}
      </AppShell>
    );
  } catch {
    notFound();
  }
}
