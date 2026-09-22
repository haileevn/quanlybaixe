import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { parseAddonCodes } from "@/lib/modules";

export async function getActiveSubscription(tenantId: string) {
  const sub = await prisma.subscription.findFirst({
    where: { tenantId, status: "ACTIVE", deletedAt: null },
    include: { plan: true },
    orderBy: { endsAt: "desc" },
  });
  if (!sub) {
    throw new AppError("Bãi xe chưa có gói dịch vụ.", "NOT_FOUND");
  }
  return sub;
}

export async function assertSubscriptionActive(tenantId: string) {
  const sub = await getActiveSubscription(tenantId);
  const now = new Date();
  if (sub.status === "EXPIRED" || sub.endsAt < now) {
    throw new AppError(
      "Gói dịch vụ hoặc thời hạn dùng thử của bạn đã hết hạn. Vui lòng đăng ký gói mới để tiếp tục.",
      "PLAN_LIMIT",
      { isExpired: "1", planCode: sub.plan.code }
    );
  }
  return sub;
}

function isUnlimited(limit: number) {
  return limit < 0;
}

export async function assertVehicleLimit(tenantId: string) {
  const sub = await assertSubscriptionActive(tenantId);
  if (isUnlimited(sub.plan.maxVehicles)) {
    return sub.plan;
  }
  const count = await prisma.vehicle.count({
    where: { tenantId, deletedAt: null, isDemo: false },
  });
  if (count >= sub.plan.maxVehicles) {
    throw new AppError(
      `Gói hiện tại của bạn tối đa ${sub.plan.maxVehicles} xe. Nâng cấp để thêm nữa.`,
      "PLAN_LIMIT",
      { limit: sub.plan.maxVehicles, kind: "xe" },
    );
  }
  return sub.plan;
}

export async function remainingVehicleSlots(tenantId: string) {
  const sub = await getActiveSubscription(tenantId);
  if (isUnlimited(sub.plan.maxVehicles)) {
    return Number.POSITIVE_INFINITY;
  }
  const count = await prisma.vehicle.count({
    where: { tenantId, deletedAt: null, isDemo: false },
  });
  return Math.max(0, sub.plan.maxVehicles - count);
}

export async function assertStaffLimit(tenantId: string) {
  const sub = await assertSubscriptionActive(tenantId);
  if (isUnlimited(sub.plan.maxStaff)) {
    return sub.plan;
  }
  const count = await prisma.userTenant.count({
    where: {
      tenantId,
      deletedAt: null,
      role: { in: ["MANAGER", "STAFF", "VIEWER"] },
    },
  });
  if (count >= sub.plan.maxStaff) {
    throw new AppError(
      `Gói hiện tại của bạn tối đa ${sub.plan.maxStaff} nhân viên. Nâng cấp để thêm nữa.`,
      "PLAN_LIMIT",
      { limit: sub.plan.maxStaff, kind: "nhan_vien" },
    );
  }
  return sub.plan;
}

export async function assertBranchLimit(tenantId: string) {
  const sub = await assertSubscriptionActive(tenantId);
  if (isUnlimited(sub.plan.maxBranches)) {
    return sub.plan;
  }
  const count = await prisma.branch.count({
    where: { tenantId, deletedAt: null, isDemo: false },
  });
  if (count >= sub.plan.maxBranches) {
    throw new AppError(
      `Gói hiện tại của bạn tối đa ${sub.plan.maxBranches} bãi. Nâng cấp để thêm nữa.`,
      "PLAN_LIMIT",
      { limit: sub.plan.maxBranches, kind: "bai" },
    );
  }
  return sub.plan;
}

export async function getBillingSnapshot(tenantId: string) {
  const sub = await getActiveSubscription(tenantId);
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { approvalStatus: true, approvedAt: true },
  });

  const now = new Date();
  const isExpired = sub.status === "EXPIRED" || sub.endsAt < now;

  const vehicles = await prisma.vehicle.count({
    where: { tenantId, deletedAt: null, isDemo: false },
  });
  const staff = await prisma.userTenant.count({
    where: {
      tenantId,
      deletedAt: null,
      role: { in: ["MANAGER", "STAFF", "VIEWER"] },
    },
  });
  const branches = await prisma.branch.count({
    where: { tenantId, deletedAt: null, isDemo: false },
  });

  return {
    planName: sub.plan.name,
    planCode: sub.plan.code,
    endsAt: sub.endsAt,
    status: isExpired ? "EXPIRED" : sub.status,
    isExpired,
    approvalStatus: tenant?.approvalStatus ?? "APPROVED",
    paidAddons: parseAddonCodes(sub.paidAddons),
    maxDailyScans: sub.plan.maxDailyScans,
    maxMonthlyScans: sub.plan.maxMonthlyScans,
    usage: {
      vehicles,
      maxVehicles: sub.plan.maxVehicles,
      staff,
      maxStaff: sub.plan.maxStaff,
      branches,
      maxBranches: sub.plan.maxBranches,
    },
  };
}
