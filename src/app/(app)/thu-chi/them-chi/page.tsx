import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ExpensePageClient } from "@/components/finance/ExpensePageClient";
import { getTenantContext } from "@/lib/session";
import { canRecordExpense } from "@/lib/rbac";
import { ensureExpenseCategories, listExpenseCategories } from "@/services/cash.service";

export default async function ExpensePage() {
  const { db, user } = await getTenantContext();
  if (!canRecordExpense(user.role)) redirect("/thu-chi");
  await ensureExpenseCategories(user.tenantId);
  const categories = await listExpenseCategories(db);
  return (
    <AppShell title="Ghi khoản chi">
      <ExpensePageClient categories={categories.map((row) => ({ id: row.id, name: row.name }))} />
    </AppShell>
  );
}
