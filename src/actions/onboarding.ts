"use server";

import { AppError, fail, ok, type ActionResult } from "@/lib/errors";
import { getTenantContext } from "@/lib/session";
import { canManageSettings } from "@/lib/rbac";
import { onboardingSchema } from "@/lib/validators/business";
import { completeOnboarding } from "@/services/tenant.service";

export async function completeOnboardingAction(input: unknown): Promise<ActionResult> {
  try {
    const { user } = await getTenantContext();
    if (!canManageSettings(user.role)) {
      throw new AppError("Chỉ chủ bãi mới hoàn tất thiết lập ban đầu.", "FORBIDDEN");
    }
    const data = onboardingSchema.parse(input);
    await completeOnboarding({
      tenantId: user.tenantId,
      tenantName: data.tenantName,
      branchName: data.branchName,
      modules: {
        xeThang: data.xeThang,
        phongTro: data.phongTro,
        matBang: data.matBang,
        sacDien: data.sacDien,
        dichVu: data.dichVu,
      },
    });
    return ok();
  } catch (error) {
    return fail(error);
  }
}
