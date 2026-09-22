"use server";

import { fail, ok, type ActionResult } from "@/lib/errors";
import { requireSuperAdmin } from "@/lib/session";
import { approvePayment, rejectPayment } from "@/services/billing.service";
import {
  updateAddonPrice,
  updatePlanPrice,
  approveTenant,
  rejectTenant,
} from "@/services/admin.service";

export async function approveTenantAction(tenantId: string): Promise<ActionResult> {
  try {
    const admin = await requireSuperAdmin();
    await approveTenant(tenantId, admin.id);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function rejectTenantAction(tenantId: string): Promise<ActionResult> {
  try {
    const admin = await requireSuperAdmin();
    await rejectTenant(tenantId, admin.id);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function approvePaymentAction(paymentId: string): Promise<ActionResult> {
  try {
    const admin = await requireSuperAdmin();
    await approvePayment(admin.id, paymentId);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function rejectPaymentAction(
  paymentId: string,
  note?: string,
): Promise<ActionResult> {
  try {
    const admin = await requireSuperAdmin();
    await rejectPayment(admin.id, paymentId, note);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function savePlanAction(input: {
  id: string;
  name: string;
  monthlyPrice: number;
  maxVehicles: number;
  maxStaff: number;
  maxBranches: number;
  maxDailyScans?: number;
  maxMonthlyScans?: number;
}): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
    await updatePlanPrice(input);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function saveAddonAction(input: {
  id: string;
  name: string;
  monthlyPrice: number;
  isActive: boolean;
}): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
    await updateAddonPrice(input);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function adminUpdateUserAction(input: unknown): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
    const { adminUpdateUserSchema } = await import("@/lib/validators/auth");
    const data = adminUpdateUserSchema.parse(input);
    const { adminUpdateUser } = await import("@/services/admin.service");
    await adminUpdateUser(data);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function adminResetUserPasswordAction(input: unknown): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
    const { adminResetPasswordSchema } = await import("@/lib/validators/auth");
    const data = adminResetPasswordSchema.parse(input);
    const { adminResetUserPassword } = await import("@/services/admin.service");
    await adminResetUserPassword(data.userId, data.newPassword);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function adminUpdateSelfAction(input: {
  name: string;
  email: string;
  phone?: string;
  currentPassword?: string;
  newPassword?: string;
}): Promise<ActionResult> {
  try {
    const admin = await requireSuperAdmin();
    const { adminUpdateSelf } = await import("@/services/admin.service");
    await adminUpdateSelf(admin.id, input);
    return ok();
  } catch (error) {
    return fail(error);
  }
}
