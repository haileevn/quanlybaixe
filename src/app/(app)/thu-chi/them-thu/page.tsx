import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { CashForm } from "@/components/finance/CashForm";
import { getTenantContext } from "@/lib/session";
import { canCollect } from "@/lib/rbac";

export default async function WalkInPage() {
  const { user } = await getTenantContext();
  if (!canCollect(user.role)) redirect("/thu-chi");
  return (
    <AppShell title="Thu vãng lai">
      <p className="mb-4 text-base text-neutral-600">Gửi xe lượt, thu lặt vặt.</p>
      <CashForm kind="THU" />
    </AppShell>
  );
}
