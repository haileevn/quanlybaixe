import { PlanCode, PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { ALL_MODULES_ON, DEFAULT_REMINDER_CONFIG } from "../src/lib/modules";
import { enableDemoData } from "../src/services/demo.service";
import { ensureExpenseCategories } from "../src/services/cash.service";

const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      code: PlanCode.DUNG_THU,
      name: "Dùng thử",
      maxBranches: 1,
      maxVehicles: 30,
      maxStaff: 1,
      monthlyPrice: 0,
      trialDays: 14,
      maxDailyScans: 5,
      maxMonthlyScans: 30,
    },
    {
      code: PlanCode.CO_BAN,
      name: "Cơ bản",
      maxBranches: 1,
      maxVehicles: 200,
      maxStaff: 3,
      monthlyPrice: 199000,
      trialDays: 0,
      maxDailyScans: -1,
      maxMonthlyScans: -1,
    },
    {
      code: PlanCode.NANG_CAO,
      name: "Nâng cao",
      maxBranches: 3,
      maxVehicles: 1000,
      maxStaff: 10,
      monthlyPrice: 499000,
      trialDays: 0,
      maxDailyScans: -1,
      maxMonthlyScans: -1,
    },
    {
      code: PlanCode.DOANH_NGHIEP,
      name: "Doanh nghiệp",
      maxBranches: -1,
      maxVehicles: -1,
      maxStaff: -1,
      monthlyPrice: 0,
      trialDays: 0,
      maxDailyScans: -1,
      maxMonthlyScans: -1,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }

  const addons = [
    { code: "phongTro", name: "Phòng trọ", monthlyPrice: 49000 },
    { code: "matBang", name: "Mặt bằng", monthlyPrice: 49000 },
    { code: "sacDien", name: "Sạc xe điện", monthlyPrice: 79000 },
    { code: "dichVu", name: "Dịch vụ khác", monthlyPrice: 29000 },
  ];
  for (const addon of addons) {
    await prisma.planAddon.upsert({
      where: { code: addon.code },
      update: addon,
      create: addon,
    });
  }

  const adminEmail = "admin@quanlybaixe.vn";
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Quản trị hệ thống",
      passwordHash: await argon2.hash("Admin@123456"),
      isSuperAdmin: true,
      isActive: true,
    },
    create: {
      email: adminEmail,
      name: "Quản trị hệ thống",
      passwordHash: await argon2.hash("Admin@123456"),
      isSuperAdmin: true,
      isActive: true,
    },
  });

  const demoEmail = "demo@baixe.vn";
  const trial = await prisma.plan.findUniqueOrThrow({ where: { code: PlanCode.DUNG_THU } });
  const demoUser = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {
      name: "Chị Minh Tâm",
      phone: "0909000111",
      passwordHash: await argon2.hash("Demo@123456"),
      isActive: true,
    },
    create: {
      email: demoEmail,
      name: "Chị Minh Tâm",
      phone: "0909000111",
      passwordHash: await argon2.hash("Demo@123456"),
      isActive: true,
    },
  });

  let tenant = await prisma.tenant.findUnique({ where: { slug: "bai-xe-minh-tam" } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "Bãi xe Minh Tâm",
        slug: "bai-xe-minh-tam",
        onboardingCompleted: true,
        approvalStatus: "APPROVED",
        enabledModules: ALL_MODULES_ON,
        reminderConfig: DEFAULT_REMINDER_CONFIG,
      },
    });
  } else {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { approvalStatus: "APPROVED" },
    });
  }

  let branch = await prisma.branch.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
  });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: "Bãi xe Minh Tâm - 12 Nguyễn Văn Cừ, Q.5",
        address: "12 Nguyễn Văn Cừ, Phường 2, Quận 5, TP.HCM",
        phone: "02838551234",
      },
    });
  }

  await prisma.userTenant.upsert({
    where: { userId_tenantId: { userId: demoUser.id, tenantId: tenant.id } },
    update: { role: "OWNER", branchId: branch.id },
    create: {
      userId: demoUser.id,
      tenantId: tenant.id,
      role: "OWNER",
      branchId: branch.id,
    },
  });

  const existingSub = await prisma.subscription.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
  });
  if (!existingSub) {
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: trial.id,
        status: "ACTIVE",
        startsAt,
        endsAt,
      },
    });
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { enabledModules: ALL_MODULES_ON },
  });
  await enableDemoData(tenant.id, demoUser.id, branch.id);
  await ensureExpenseCategories(tenant.id);

  console.info("Seed xong.");
  console.info("Super admin:", admin.email, "/ Admin@123456");
  console.info("Chủ bãi demo:", demoEmail, "/ Demo@123456");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
