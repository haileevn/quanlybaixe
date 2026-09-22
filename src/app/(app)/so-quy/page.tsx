import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { CashbookPanel } from "@/components/finance/CashbookPanel";
import { getTenantContext } from "@/lib/session";
import { canViewProfit } from "@/lib/rbac";
import { getCashbookView } from "@/services/cash.service";

export default async function CashbookPage() {
  const { db, user } = await getTenantContext();
  if (!canViewProfit(user.role)) redirect("/");
  const view = await getCashbookView(db, user.tenantId, user.branchId);
  return (
    <AppShell title="Sổ quỹ">
      <CashbookPanel {...view} />
    </AppShell>
  );
}
