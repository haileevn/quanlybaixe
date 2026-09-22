import { AdminPaymentList } from "@/components/admin/AdminPaymentList";
import { requireSuperAdmin } from "@/lib/session";
import { listPendingPayments } from "@/services/billing.service";
import { toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function AdminPaymentsPage() {
  await requireSuperAdmin();
  const rows = await listPendingPayments();
  const withPlan = await Promise.all(
    rows.map(async (row) => {
      const plan = await prisma.plan.findUnique({ where: { id: row.targetPlanId } });
      return {
        id: row.id,
        tenantName: `${row.tenant.name} (${plan?.name ?? "Gói"})`,
        amount: toNumber(row.amount),
        transferContent: row.transferContent,
        createdAt: row.createdAt,
      };
    }),
  );
  return (
    <div>
      <h2 className="mb-3 text-2xl font-black">Duyệt chuyển khoản</h2>
      <AdminPaymentList rows={withPlan} />
    </div>
  );
}
