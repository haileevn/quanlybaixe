import type { TenantClient } from "@/lib/prisma-tenant";

export async function findOrCreateCustomer(
  db: TenantClient,
  input: {
    tenantId: string;
    branchId: string;
    name: string;
    phone: string;
    address?: string;
    isDemo?: boolean;
  },
) {
  const phone = input.phone.trim();
  const existing = await db.customer.findFirst({
    where: { phone, branchId: input.branchId },
  });
  if (existing) {
    return db.customer.update({
      where: { id: existing.id },
      data: {
        name: input.name.trim(),
        address: input.address ?? existing.address,
      },
    });
  }
  return db.customer.create({
    data: {
      tenantId: input.tenantId,
      branchId: input.branchId,
      name: input.name.trim(),
      phone,
      address: input.address,
      isDemo: input.isDemo ?? false,
    },
  });
}
