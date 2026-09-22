"use server";

import { AppError, fail, ok, type ActionResult } from "@/lib/errors";
import { getTenantContext } from "@/lib/session";
import { canManageStaff } from "@/lib/rbac";
import { staffFormSchema } from "@/lib/validators/business";
import {
  createStaff,
  listStaff,
  resetStaffPassword,
  setStaffDisabled,
} from "@/services/staff.service";
import { ROLE_LABEL } from "@/lib/plate";

export async function listStaffAction() {
  try {
    const { user } = await getTenantContext();
    if (!canManageStaff(user.role)) {
      throw new AppError("Chỉ chủ bãi mới xem danh sách nhân viên.", "FORBIDDEN");
    }
    const rows = await listStaff(user.tenantId);
    return ok(
      rows.map((row) => ({
        id: row.id,
        name: row.user.name,
        email: row.user.email,
        role: row.role,
        roleLabel: ROLE_LABEL[row.role],
        disabled: Boolean(row.disabledAt),
        isOwner: row.role === "OWNER",
      })),
    );
  } catch (error) {
    return fail(error);
  }
}

export async function createStaffAction(input: unknown): Promise<ActionResult> {
  try {
    const { user } = await getTenantContext();
    if (!canManageStaff(user.role)) {
      throw new AppError("Chỉ chủ bãi mới tạo nhân viên.", "FORBIDDEN");
    }
    const data = staffFormSchema.parse(input);
    await createStaff({
      tenantId: user.tenantId,
      branchId: user.branchId,
      actorUserId: user.id,
      ...data,
    });
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function resetStaffPasswordAction(
  userTenantId: string,
  password: string,
): Promise<ActionResult> {
  try {
    const { user } = await getTenantContext();
    if (!canManageStaff(user.role)) {
      throw new AppError("Chỉ chủ bãi mới đặt lại mật khẩu.", "FORBIDDEN");
    }
    await resetStaffPassword({
      tenantId: user.tenantId,
      actorUserId: user.id,
      userTenantId,
      password,
    });
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function toggleStaffAction(
  userTenantId: string,
  disabled: boolean,
): Promise<ActionResult> {
  try {
    const { user } = await getTenantContext();
    if (!canManageStaff(user.role)) {
      throw new AppError("Chỉ chủ bãi mới khoá tài khoản.", "FORBIDDEN");
    }
    await setStaffDisabled({
      tenantId: user.tenantId,
      actorUserId: user.id,
      userTenantId,
      disabled,
    });
    return ok();
  } catch (error) {
    return fail(error);
  }
}
