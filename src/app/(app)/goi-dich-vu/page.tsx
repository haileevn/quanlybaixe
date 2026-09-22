import { AppShell } from "@/components/layout/AppShell";
import { BillingPanel } from "@/components/finance/BillingPanel";
import { toNumber } from "@/lib/money";
import { getTenantContext } from "@/lib/session";
import { getBillingSnapshot } from "@/services/plan.service";
import {
  getPaymentQr,
  listActiveAddons,
  listPlansForBilling,
  listTenantPayments,
} from "@/services/billing.service";

function limitLabel(n: number) {
  return n < 0 ? "Không giới hạn" : String(n);
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ pay?: string; addon?: string }>;
}) {
  const { user } = await getTenantContext();
  const { pay, addon } = await searchParams;
  const snap = await getBillingSnapshot(user.tenantId);
  const plans = await listPlansForBilling();
  const addons = await listActiveAddons();
  const payments = await listTenantPayments(user.tenantId);
  const planById = new Map(plans.map((p) => [p.id, p.name]));

  let qr: Parameters<typeof BillingPanel>[0]["qr"];
  if (pay) {
    try {
      const data = await getPaymentQr(pay, user.tenantId);
      qr = {
        paymentId: data.payment.id,
        qrDataUrl: data.qrDataUrl,
        bankName: data.bank.bankName,
        accountNo: data.bank.accountNo,
        accountName: data.bank.accountName,
        transferContent: data.payment.transferContent ?? "",
        amount: toNumber(data.payment.amount),
        planName: data.planName,
        status: data.payment.status,
      };
    } catch {
      qr = undefined;
    }
  }

  return (
    <AppShell title="Gói dịch vụ">
      <p className="mb-3 text-base text-neutral-600">
        Xe {snap.usage.vehicles}/{limitLabel(snap.usage.maxVehicles)} · Nhân viên{" "}
        {snap.usage.staff}/{limitLabel(snap.usage.maxStaff)}
      </p>
      <BillingPanel
        currentPlan={snap.planName}
        endsAt={snap.endsAt}
        prepaidAddons={snap.paidAddons}
        preselectAddon={addon}
        addons={addons.map((row) => ({
          code: row.code,
          name: row.name,
          monthlyPrice: toNumber(row.monthlyPrice),
        }))}
        plans={plans.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          monthlyPrice: toNumber(p.monthlyPrice),
        }))}
        payments={payments.map((row) => ({
          id: row.id,
          amount: toNumber(row.amount),
          status: row.status,
          transferContent: row.transferContent,
          createdAt: row.createdAt,
          planName: planById.get(row.targetPlanId) ?? row.subscription.plan.name,
        }))}
        qr={qr}
      />
    </AppShell>
  );
}
