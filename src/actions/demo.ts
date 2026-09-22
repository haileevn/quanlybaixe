"use server";

import { AppError, fail, ok, type ActionResult } from "@/lib/errors";
import { getTenantContext } from "@/lib/session";
import { canManageSettings } from "@/lib/rbac";
import { disableDemoData, enableDemoData } from "@/services/demo.service";
import { getTenantOrThrow } from "@/services/tenant.service";

export async function toggleDemoAction(enabled: boolean): Promise<ActionResult> {
  try {
    const { user } = await getTenantContext();
    if (!canManageSettings(user.role)) {
      throw new AppError("Chỉ chủ bãi mới bật dữ liệu mẫu.", "FORBIDDEN");
    }
    if (enabled) {
      await enableDemoData(user.tenantId, user.id, user.branchId);
    } else {
      await disableDemoData(user.tenantId);
    }
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function getDemoFlagAction(): Promise<ActionResult<boolean>> {
  try {
    const { user } = await getTenantContext();
    const tenant = await getTenantOrThrow(user.tenantId);
    return ok(tenant.demoDataEnabled);
  } catch (error) {
    return fail(error);
  }
}
