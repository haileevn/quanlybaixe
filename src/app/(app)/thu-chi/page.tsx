import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { getTenantContext } from "@/lib/session";
import { canCollect, canRecordExpense } from "@/lib/rbac";
import { ensureExpenseCategories, listTransactions } from "@/services/cash.service";
import { formatVnd } from "@/lib/money";
import { formatVnDateTime, vnStartOfDay } from "@/lib/datetime";
import { redirect } from "next/navigation";
import { isReadOnly } from "@/lib/rbac";

export default async function CashPage() {
  const { db, user } = await getTenantContext();
  if (isReadOnly(user.role)) {
    redirect("/");
  }
  await ensureExpenseCategories(user.tenantId);
  const rows = await listTransactions(db, {
    from: vnStartOfDay().subtract(30, "day").toDate(),
    to: vnStartOfDay().endOf("day").toDate(),
  });

  return (
    <AppShell title="Thu — Chi">
      <div className="mb-4 grid grid-cols-2 gap-3">
        {canCollect(user.role) ? (
          <Link
            href="/thu-chi/them-thu"
            className="flex h-14 items-center justify-center rounded-xl bg-[#0F4C5C] text-base font-semibold text-white"
          >
            Thu vãng lai
          </Link>
        ) : null}
        {canRecordExpense(user.role) ? (
          <Link
            href="/thu-chi/them-chi"
            className="flex h-14 items-center justify-center rounded-xl bg-white text-base font-semibold ring-1 ring-[#0F4C5C]/20"
          >
            Ghi khoản chi
          </Link>
        ) : null}
      </div>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl bg-white p-4">
            <p className={row.type === "THU" ? "text-lg font-black text-emerald-800" : "text-lg font-black text-red-800"}>
              {row.type === "THU" ? "+" : "−"}
              {formatVnd(row.amount)}
            </p>
            <p className="text-base">
              {row.type === "THU" ? "Thu" : row.expenseCategory?.name ?? "Chi"} ·{" "}
              {row.method === "TIEN_MAT" ? "Tiền mặt" : "Chuyển khoản"}
            </p>
            <p className="text-sm text-neutral-600">
              {formatVnDateTime(row.occurredAt)} · {row.collectedBy.name}
            </p>
            {row.note ? <p className="text-sm">{row.note}</p> : null}
          </li>
        ))}
      </ul>
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center">30 ngày nay chưa có giao dịch.</p>
      ) : null}
    </AppShell>
  );
}
