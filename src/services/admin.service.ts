import argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import { nowVn } from "@/lib/datetime";
import { AppError } from "@/lib/errors";

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

export async function listUsersForAdmin() {
  const users = await prisma.user.findMany({
    include: {
      userTenants: {
        where: { deletedAt: null },
        include: {
          tenant: { select: { id: true, name: true, slug: true, approvalStatus: true } },
          branch: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    isSuperAdmin: u.isSuperAdmin,
    isActive: u.isActive,
    createdAt: u.createdAt,
    tenants: u.userTenants.map((ut) => ({
      tenantId: ut.tenant.id,
      tenantName: ut.tenant.name,
      tenantSlug: ut.tenant.slug,
      approvalStatus: ut.tenant.approvalStatus,
      role: ut.role,
      branchName: ut.branch?.name ?? "—",
      disabledAt: ut.disabledAt,
    })),
  }));
}

export async function adminUpdateUser(input: {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  isSuperAdmin?: boolean;
  isActive?: boolean;
  newPassword?: string;
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) {
    throw new AppError("Không tìm thấy người dùng.", "NOT_FOUND");
  }

  const email = input.email.trim().toLowerCase();
  if (email !== user.email) {
    const conflict = await prisma.user.findUnique({ where: { email } });
    if (conflict) {
      throw new AppError("Email này đã thuộc về người dùng khác.", "CONFLICT");
    }
  }

  const updateData: {
    name: string;
    email: string;
    phone: string | null;
    isSuperAdmin?: boolean;
    isActive?: boolean;
    passwordHash?: string;
  } = {
    name: input.name.trim(),
    email,
    phone: input.phone ? input.phone.trim() : null,
  };

  if (input.isSuperAdmin !== undefined) {
    updateData.isSuperAdmin = input.isSuperAdmin;
  }
  if (input.isActive !== undefined) {
    updateData.isActive = input.isActive;
  }
  if (input.newPassword && input.newPassword.trim().length >= 6) {
    updateData.passwordHash = await argon2.hash(input.newPassword.trim());
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: updateData,
  });
}

export async function adminResetUserPassword(userId: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("Không tìm thấy người dùng.", "NOT_FOUND");
  }
  if (newPassword.trim().length < 6) {
    throw new AppError("Mật khẩu mới tối thiểu 6 ký tự.", "VALIDATION");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await argon2.hash(newPassword.trim()) },
  });
}

export async function adminUpdateSelf(adminId: string, input: { name: string; email: string; phone?: string; currentPassword?: string; newPassword?: string }) {
  const admin = await prisma.user.findUnique({ where: { id: adminId } });
  if (!admin || !admin.isSuperAdmin) {
    throw new AppError("Không tìm thấy tài khoản quản trị.", "UNAUTHORIZED");
  }

  const email = input.email.trim().toLowerCase();
  if (email !== admin.email) {
    const conflict = await prisma.user.findUnique({ where: { email } });
    if (conflict && conflict.id !== adminId) {
      throw new AppError("Email này đã thuộc về người dùng khác.", "CONFLICT");
    }
  }

  const updateData: { name: string; email: string; phone: string | null; passwordHash?: string } = {
    name: input.name.trim(),
    email,
    phone: input.phone ? input.phone.trim() : null,
  };

  if (input.newPassword && input.newPassword.trim().length >= 6) {
    if (!input.currentPassword) {
      throw new AppError("Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu.", "VALIDATION");
    }
    const valid = await argon2.verify(admin.passwordHash, input.currentPassword);
    if (!valid) {
      throw new AppError("Mật khẩu hiện tại không đúng.", "VALIDATION");
    }
    updateData.passwordHash = await argon2.hash(input.newPassword.trim());
  }

  await prisma.user.update({
    where: { id: adminId },
    data: updateData,
  });
}
