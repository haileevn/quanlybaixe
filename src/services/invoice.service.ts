import type { TenantClient } from "@/lib/prisma-tenant";

export async function listUnpaidInvoices(db: TenantClient) {
  return db.invoice.findMany({
    where: { status: "CHUA_THANH_TOAN" },
    include: { customer: true },
    orderBy: { dueDate: "asc" },
    take: 100,
  });
}
