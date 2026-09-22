import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import { nowVn } from "@/lib/datetime";

export async function getAdminStats() {
  const [tenants, pendingTenants, pendingPayments, approvedPayments] = await Promise.all([
    prisma.tenant.count({ where: { deletedAt: null } }),
    prisma.tenant.count({ where: { approvalStatus: "PENDING", deletedAt: null } }),
    prisma.payment.count({ where: { status: "PENDING", deletedAt: null } }),
    prisma.payment.findMany({
      where: { status: "APPROVED", deletedAt: null },
      select: { amount: true },
    }),
  ]);
  const revenue = approvedPayments.reduce((sum, row) => sum + toNumber(row.amount), 0);
  return { tenants, pendingTenants, pendingPayments, pending: pendingPayments, revenue };
}

export async function listTenantsForAdmin() {
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    include: {
      subscriptions: {
        where: { deletedAt: null, status: "ACTIVE" },
        include: { plan: true },
        orderBy: { endsAt: "desc" },
        take: 1,
      },
      userTenants: {
        where: { role: "OWNER", deletedAt: null },
        include: { user: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return tenants.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    approvalStatus: row.approvalStatus,
    approvedAt: row.approvedAt,
    onboardingCompleted: row.onboardingCompleted,
    createdAt: row.createdAt,
    planName: row.subscriptions[0]?.plan.name ?? "Chưa có gói",
    planCode: row.subscriptions[0]?.plan.code ?? "DUNG_THU",
    endsAt: row.subscriptions[0]?.endsAt ?? null,
    ownerName: row.userTenants[0]?.user.name ?? "—",
    ownerEmail: row.userTenants[0]?.user.email ?? "—",
    ownerPhone: row.userTenants[0]?.user.phone ?? "—",
  }));
}

export async function approveTenant(tenantId: string, adminUserId?: string) {
  const startsAt = nowVn().toDate();
  const sub = await prisma.subscription.findFirst({
    where: { tenantId, deletedAt: null },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  const trialDays = sub?.plan.trialDays || 14;
  const endsAt = nowVn().add(trialDays, "day").toDate();

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        approvalStatus: "APPROVED",
        approvedAt: startsAt,
        approvedBy: adminUserId ?? null,
      },
    });

    if (sub) {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: "ACTIVE",
          startsAt,
          endsAt,
        },
      });
    }
  });
}

export async function rejectTenant(tenantId: string, adminUserId?: string) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      approvalStatus: "REJECTED",
      approvedAt: new Date(),
      approvedBy: adminUserId ?? null,
    },
  });
}

export async function listPlansForAdmin() {
  return prisma.plan.findMany({ orderBy: { monthlyPrice: "asc" } });
}

export async function listAddonsForAdmin() {
  return prisma.planAddon.findMany({ orderBy: { monthlyPrice: "asc" } });
}

export async function updatePlanPrice(input: {
  id: string;
  monthlyPrice: number;
  maxVehicles: number;
  maxStaff: number;
  maxBranches: number;
  name: string;
  maxDailyScans?: number;
  maxMonthlyScans?: number;
}) {
  await prisma.plan.update({
    where: { id: input.id },
    data: {
      name: input.name.trim(),
      monthlyPrice: input.monthlyPrice,
      maxVehicles: input.maxVehicles,
      maxStaff: input.maxStaff,
      maxBranches: input.maxBranches,
      maxDailyScans: input.maxDailyScans !== undefined ? input.maxDailyScans : -1,
      maxMonthlyScans: input.maxMonthlyScans !== undefined ? input.maxMonthlyScans : -1,
    },
  });
}

export async function updateAddonPrice(input: { id: string; name: string; monthlyPrice: number; isActive: boolean }) {
  await prisma.planAddon.update({
    where: { id: input.id },
    data: {
      name: input.name.trim(),
      monthlyPrice: input.monthlyPrice,
      isActive: input.isActive,
    },
  });
}
