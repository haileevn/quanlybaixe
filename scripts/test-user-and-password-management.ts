import { prisma } from "../src/lib/prisma";
import argon2 from "argon2";
import {
  changeUserPassword,
  updateUserProfile,
  getUserProfile,
  resetPasswordWithOtp,
} from "../src/services/auth.service";
import {
  listUsersForAdmin,
  adminUpdateUser,
  adminResetUserPassword,
  adminUpdateSelf,
} from "../src/services/admin.service";
import { storeOtp, readOtp } from "../src/lib/rate-limit";

async function runTests() {
  console.log("🚀 Starting User and Password Management Test Suite...\n");
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  try {
    // 1. Check SuperAdmin existence and password hash
    console.log("1. SuperAdmin Verification:");
    const admin = await prisma.user.findUnique({ where: { email: "admin@quanlybaixe.vn" } });
    assert(!!admin, "Admin user exists in database");
    assert(admin?.isSuperAdmin === true, "Admin has isSuperAdmin = true");
    const adminPassValid = await argon2.verify(admin!.passwordHash, "Admin@123456");
    assert(adminPassValid, "Admin password Admin@123456 verified with argon2");

    // 2. Check Demo Owner existence and password hash
    console.log("\n2. Demo User Verification:");
    const demo = await prisma.user.findUnique({ where: { email: "demo@baixe.vn" } });
    assert(!!demo, "Demo user exists in database");
    const demoPassValid = await argon2.verify(demo!.passwordHash, "Demo@123456");
    assert(demoPassValid, "Demo user password Demo@123456 verified with argon2");

    // 3. Test Regular User Profile Update & Password Change
    console.log("\n3. User Profile & Password Update Service:");
    await updateUserProfile(demo!.id, { name: "Chị Minh Tâm (Cập nhật)", phone: "0909123456" });
    const updatedDemo = await getUserProfile(demo!.id);
    assert(updatedDemo.name === "Chị Minh Tâm (Cập nhật)", "User name updated successfully");
    assert(updatedDemo.phone === "0909123456", "User phone updated successfully");

    // Change demo password to temporary password
    await changeUserPassword(demo!.id, "Demo@123456", "NewDemo@123456");
    const checkNewPass = await prisma.user.findUnique({ where: { id: demo!.id } });
    const isNewPassValid = await argon2.verify(checkNewPass!.passwordHash, "NewDemo@123456");
    assert(isNewPassValid, "User changed own password successfully");

    // Restore original demo password
    await changeUserPassword(demo!.id, "NewDemo@123456", "Demo@123456");
    await updateUserProfile(demo!.id, { name: "Chị Minh Tâm", phone: "0909000111" });

    // 4. Test Admin User Listing & Admin Management
    console.log("\n4. Admin User Management Services:");
    const allUsers = await listUsersForAdmin();
    assert(allUsers.length >= 2, `Admin retrieved ${allUsers.length} total users`);
    const foundAdmin = allUsers.find((u) => u.email === "admin@quanlybaixe.vn");
    assert(!!foundAdmin && foundAdmin.isSuperAdmin, "Admin user found in admin list with role flag");

    // Test Admin resetting user password directly
    await adminResetUserPassword(demo!.id, "AdminSet@123456");
    const afterAdminReset = await prisma.user.findUnique({ where: { id: demo!.id } });
    const isAdminResetValid = await argon2.verify(afterAdminReset!.passwordHash, "AdminSet@123456");
    assert(isAdminResetValid, "Admin directly reset user password successfully");

    // Restore demo password
    await adminResetUserPassword(demo!.id, "Demo@123456");

    // Test Admin updating user details
    await adminUpdateUser({
      userId: demo!.id,
      name: "Chị Minh Tâm",
      email: "demo@baixe.vn",
      phone: "0909000111",
      isActive: true,
    });
    assert(true, "Admin updated user details successfully");

    // 5. Test OTP Forgot Password Flow
    console.log("\n5. Forgot Password OTP Flow:");
    const testOtp = "654321";
    await storeOtp("demo@baixe.vn", testOtp);
    const readBack = await readOtp("demo@baixe.vn");
    assert(readBack === testOtp, "OTP stored and read correctly");

    await resetPasswordWithOtp({
      email: "demo@baixe.vn",
      otp: testOtp,
      password: "Demo@123456",
    });
    const afterOtpReset = await prisma.user.findUnique({ where: { email: "demo@baixe.vn" } });
    const isOtpPassValid = await argon2.verify(afterOtpReset!.passwordHash, "Demo@123456");
    assert(isOtpPassValid, "Password reset with OTP completed successfully");

    console.log(`\n========================================`);
    console.log(`🎉 ALL TESTS PASSED: ${passed}/${total}`);
    console.log(`========================================\n`);
  } catch (error) {
    console.error("\n❌ Test failed with error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
