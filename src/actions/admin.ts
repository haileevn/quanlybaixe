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
