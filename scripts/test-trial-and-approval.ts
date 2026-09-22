import { prisma } from "../src/lib/prisma";
import { registerOwner } from "../src/services/tenant.service";
import { approveTenant, rejectTenant, updatePlanPrice } from "../src/services/admin.service";
import { checkAndRecordPlateScan, getPlateScanQuota } from "../src/services/scan-limit.service";
import { assertSubscriptionActive } from "../src/services/plan.service";
import { PlanCode } from "@prisma/client";
import { nowVn } from "../src/lib/datetime";

async function runTrialAndApprovalTests() {
  console.log("==================================================");
  console.log("🧪 BẮT ĐẦU KIỂM THỬ: DÙNG THỬ, DUYỆT ADMIN & QUOTA");
  console.log("==================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${testName}`);
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail ?? "");
    }
  }

  const testEmail = `test_owner_${Date.now()}@baixe.vn`;

  // 1. TEST ĐĂNG KÝ TÀI KHOẢN MỚI -> TRẠNG THÁI PENDING
  const regResult = await registerOwner({
    name: "Bãi xe Test Thử Nghiệm",
    email: testEmail,
    password: "Password@123456",
  });

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: regResult.tenant.id },
    include: { subscriptions: { include: { plan: true } } },
  });

  assert(
    tenant.approvalStatus === "PENDING",
    "Test 1: Đăng ký tài khoản mới mặc định ở trạng thái PENDING chờ duyệt",
    tenant.approvalStatus
  );

  // 2. TEST ADMIN DUYỆT TÀI KHOẢN -> APPROVED & RESET 14 NGÀY DÙNG THỬ
  await approveTenant(tenant.id, "admin_user_id");

  const approvedTenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenant.id },
    include: { subscriptions: { include: { plan: true } } },
  });

  const approvedSub = approvedTenant.subscriptions[0];
  const daysDiff = Math.round(
    (approvedSub.endsAt.getTime() - approvedSub.startsAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  assert(
    approvedTenant.approvalStatus === "APPROVED" && daysDiff === 14,
    "Test 2: Admin duyệt bãi xe -> approvalStatus = APPROVED & tính 14 ngày dùng thử",
    { status: approvedTenant.approvalStatus, daysDiff }
  );

  // 3. TEST QUOTA QUÉT BIỂN SỐ CHO GÓI DÙNG THỬ (Mặc định 5/ngày, 30/tháng)
  const quotaInit = await getPlateScanQuota(tenant.id);
  assert(
    quotaInit.maxDaily === 5 && quotaInit.maxMonthly === 30 && quotaInit.usedToday === 0,
    "Test 3: Hạn mức ban đầu của gói Dùng thử là 5 lượt/ngày & 30 lượt/tháng",
    quotaInit
  );

  // 4. TEST QUÉT 5 LẦN ĐẦU TIÊN THÀNH CÔNG
  for (let i = 1; i <= 5; i++) {
    const scanRes = await checkAndRecordPlateScan(tenant.id);
    assert(
      scanRes.usedToday === i,
      `Test 4.${i}: Quét lần thứ ${i}/5 thành công (usedToday = ${scanRes.usedToday})`
    );
  }

  // 5. TEST LẦN QUÉT THỨ 6 BỊ CHẶN VÌ VƯỢT HẠN MỨC NGÀY
  let blockedDaily = false;
  try {
    await checkAndRecordPlateScan(tenant.id);
  } catch (err: any) {
    if (err.message && err.message.includes("5 lượt quét/ngày")) {
      blockedDaily = true;
    }
  }
  assert(
    blockedDaily,
    "Test 5: Lần quét thứ 6 trong ngày bị chặn vì vượt quá 5 lượt/ngày"
  );

  // 6. TEST ADMIN THAY ĐỔI CẤU HÌNH HẠN MỨC QUÉT TRONG TRANG QUẢN TRỊ
  const trialPlan = await prisma.plan.findUniqueOrThrow({ where: { code: PlanCode.DUNG_THU } });
  await updatePlanPrice({
    id: trialPlan.id,
    name: trialPlan.name,
    monthlyPrice: 0,
    maxVehicles: trialPlan.maxVehicles,
    maxStaff: trialPlan.maxStaff,
    maxBranches: trialPlan.maxBranches,
    maxDailyScans: 10,
    maxMonthlyScans: 60,
  });

  // Sau khi nâng hạn mức lên 10 lượt/ngày -> Quét lần thứ 6 thành công!
  const scanRes6 = await checkAndRecordPlateScan(tenant.id);
  assert(
    scanRes6.usedToday === 6 && scanRes6.maxDaily === 10,
    "Test 6: Admin tăng hạn mức lên 10/ngày -> Quét lần 6 thành công ngay lập tức",
    scanRes6
  );

  // Trả lại cấu hình mặc định (5/ngày, 30/tháng)
  await updatePlanPrice({
    id: trialPlan.id,
    name: trialPlan.name,
    monthlyPrice: 0,
    maxVehicles: trialPlan.maxVehicles,
    maxStaff: trialPlan.maxStaff,
    maxBranches: trialPlan.maxBranches,
    maxDailyScans: 5,
    maxMonthlyScans: 30,
  });

  // 7. TEST HẾT HẠN DÙNG THỬ (EXPIRED)
  // Giả lập subscription đã hết hạn (endsAt lùi về quá khứ 1 ngày)
  await prisma.subscription.update({
    where: { id: approvedSub.id },
    data: {
      endsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  });

  let expiredBlocked = false;
  try {
    await assertSubscriptionActive(tenant.id);
  } catch (err: any) {
    if (err.message && err.message.includes("hết hạn")) {
      expiredBlocked = true;
    }
  }
  assert(
    expiredBlocked,
    "Test 7: Subscription hết hạn -> assertSubscriptionActive ném lỗi hết hạn",
    { isExpired: expiredBlocked }
  );

  // 8. TEST QUÉT BIỂN SỐ KHI GÓI HẾT HẠN BỊ CHẶN
  let scanExpiredBlocked = false;
  try {
    await checkAndRecordPlateScan(tenant.id);
  } catch (err: any) {
    if (err.message && err.message.includes("hết hạn")) {
      scanExpiredBlocked = true;
    }
  }
  assert(
    scanExpiredBlocked,
    "Test 8: checkAndRecordPlateScan chặn quét khi gói hết hạn",
    { isExpired: scanExpiredBlocked }
  );

  // Dọn dẹp dữ liệu test
  await prisma.plateScanUsage.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.subscription.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.userTenant.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.expenseCategory.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.branch.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.tenant.delete({ where: { id: tenant.id } });
  await prisma.user.delete({ where: { email: testEmail } });

  console.log("\n==================================================");
  console.log(`🏁 KẾT QUẢ KIỂM THỬ: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log("==================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runTrialAndApprovalTests()
  .catch((err) => {
    console.error("Test runner error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
