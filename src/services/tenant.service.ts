import argon2 from "argon2";
import { PlanCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { DEFAULT_MODULES, DEFAULT_REMINDER_CONFIG, type ReminderConfig } from "@/lib/modules";
import { nowVn } from "@/lib/datetime";
import { ensureExpenseCategories } from "@/services/cash.service";

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "bai-xe"}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function registerOwner(input: {
  name: string;
  email: string;
  password: string;
}) {
  const email = input.email.trim().toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    throw new AppError("Email này đã được dùng. Hãy đăng nhập.", "CONFLICT");
  }

  const plan = await prisma.plan.findUnique({ where: { code: PlanCode.DUNG_THU } });
  if (!plan) {
    throw new AppError("Hệ thống chưa sẵn sàng. Liên hệ quản trị.", "NOT_FOUND");
  }

  const passwordHash = await argon2.hash(input.password);
  const startsAt = nowVn().toDate();
  const endsAt = nowVn().add(plan.trialDays || 14, "day").toDate();
  const tenantName = `Bãi xe của ${input.name}`;

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        name: input.name.trim(),
      },
    });
    const tenant = await tx.tenant.create({
      data: {
        name: tenantName,
        slug: slugify(tenantName),
        enabledModules: DEFAULT_MODULES,
        reminderConfig: DEFAULT_REMINDER_CONFIG,
      },
    });
    const branch = await tx.branch.create({
      data: {
        tenantId: tenant.id,
        name: tenantName,
      },
    });
    await tx.userTenant.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role: "OWNER",
        branchId: branch.id,
      },
    });
    await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        status: "ACTIVE",
        startsAt,
        endsAt,
      },
    });
    return { user, tenant };
  });

  await ensureExpenseCategories(created.tenant.id);
  return created;
}

export async function completeOnboarding(input: {
  tenantId: string;
  tenantName: string;
  branchName: string;
  modules: {
    xeThang: boolean;
    phongTro: boolean;
    matBang: boolean;
    sacDien: boolean;
    dichVu: boolean;
  };
}) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: input.tenantId, deletedAt: null },
  });
  if (!tenant) {
    throw new AppError("Không tìm thấy bãi xe.", "NOT_FOUND");
  }
  await prisma.tenant.update({
    where: { id: input.tenantId },
    data: {
      name: input.tenantName.trim(),
      onboardingCompleted: true,
      enabledModules: {
        ...input.modules,
        xeThang: true,
      },
    },
  });
  const branch = await prisma.branch.findFirst({
    where: { tenantId: input.tenantId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (branch) {
    await prisma.branch.update({
      where: { id: branch.id },
      data: { name: input.branchName.trim() },
    });
  }
  await ensureExpenseCategories(input.tenantId);
}

export async function updateReminderConfig(tenantId: string, config: ReminderConfig) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { reminderConfig: config },
  });
}

export async function updateEnabledModules(
  tenantId: string,
  modules: {
    xeThang: boolean;
    phongTro: boolean;
    matBang: boolean;
    sacDien: boolean;
    dichVu: boolean;
  },
) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      enabledModules: { ...modules, xeThang: true },
    },
  });
}

export async function getTenantOrThrow(tenantId: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
  });
  if (!tenant) {
    throw new AppError("Không tìm thấy bãi xe.", "NOT_FOUND");
  }
  return tenant;
}

export async function updateTenantBank(
  tenantId: string,
  input: {
    bankBin: string;
    bankName: string;
    bankAccountNo: string;
    bankAccountName: string;
  },
) {
  const accountNo = input.bankAccountNo.replace(/\s/g, "");
  if (accountNo.length < 6) {
    throw new AppError("Số tài khoản chưa đúng.", "VALIDATION");
  }
  if (input.bankAccountName.trim().length < 3) {
    throw new AppError("Nhập tên chủ tài khoản.", "VALIDATION");
  }
  if (!/^\d{6,}$/.test(input.bankBin)) {
    throw new AppError("Chọn ngân hàng.", "VALIDATION");
  }
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      bankBin: input.bankBin,
      bankName: input.bankName.trim(),
      bankAccountNo: accountNo,
      bankAccountName: input.bankAccountName.trim().toUpperCase(),
    },
  });
}
