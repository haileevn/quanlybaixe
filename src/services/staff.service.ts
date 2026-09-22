import argon2 from "argon2";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { assertStaffLimit } from "@/services/plan.service";
import { writeAudit } from "@/services/audit.service";

const STAFF_ROLES: Role[] = ["MANAGER", "STAFF", "VIEWER"];

export async function listStaff(tenantId: string) {
  return prisma.userTenant.findMany({
    where: { tenantId, deletedAt: null },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function createStaff(input: {
  tenantId: string;
  branchId: string;
  actorUserId: string;
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: Role;
}) {
  if (!STAFF_ROLES.includes(input.role)) {
    throw new AppError("Chỉ tạo được quản lý, nhân viên hoặc người xem.", "VALIDATION");
  }
  await assertStaffLimit(input.tenantId);
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError("Email này đã có tài khoản.", "CONFLICT");
  }
  const user = await prisma.user.create({
    data: {
      email,
      name: input.name.trim(),
      phone: input.phone,
      passwordHash: await argon2.hash(input.password),
    },
  });
  const membership = await prisma.userTenant.create({
    data: {
      tenantId: input.tenantId,
      userId: user.id,
      role: input.role,
      branchId: input.branchId,
    },
  });
  await writeAudit({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    action: "TAO_NHAN_VIEN",
    entityType: "UserTenant",
    entityId: membership.id,
    after: { email, role: input.role },
  });
  return membership;
}

export async function resetStaffPassword(input: {
  tenantId: string;
  actorUserId: string;
  userTenantId: string;
  password: string;
}) {
  const membership = await prisma.userTenant.findFirst({
    where: { id: input.userTenantId, tenantId: input.tenantId, deletedAt: null },
  });
  if (!membership || membership.role === "OWNER") {
    throw new AppError("Không đặt lại mật khẩu tài khoản này.", "FORBIDDEN");
  }
  await prisma.user.update({
    where: { id: membership.userId },
    data: { passwordHash: await argon2.hash(input.password) },
  });
  await writeAudit({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    action: "DAT_LAI_MAT_KHAU",
    entityType: "User",
    entityId: membership.userId,
  });
}

export async function setStaffDisabled(input: {
  tenantId: string;
  actorUserId: string;
  userTenantId: string;
  disabled: boolean;
}) {
  const membership = await prisma.userTenant.findFirst({
    where: { id: input.userTenantId, tenantId: input.tenantId, deletedAt: null },
  });
  if (!membership || membership.role === "OWNER") {
    throw new AppError("Không khoá tài khoản chủ bãi.", "FORBIDDEN");
  }
  await prisma.userTenant.update({
    where: { id: membership.id },
    data: { disabledAt: input.disabled ? new Date() : null },
  });
  await writeAudit({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    action: input.disabled ? "KHOA_TAI_KHOAN" : "MO_TAI_KHOAN",
    entityType: "UserTenant",
    entityId: membership.id,
  });
}
