"use server";

import { AppError, fail, ok, type ActionResult } from "@/lib/errors";
import { getTenantContext, requireEnabledModule } from "@/lib/session";
import { canCollect, canDelete, canEditVehicle, canManageSettings } from "@/lib/rbac";
import {
  chargerSchema,
  chargingPlanSchema,
  collectTargetSchema,
  serviceSubSchema,
  serviceTypeSchema,
  startChargeSchema,
  stopChargeSchema,
} from "@/lib/validators/business";
import { formatVnd } from "@/lib/money";
import { formatVnDate } from "@/lib/datetime";
import {
  createServiceType,
  deleteServiceType,
  subscribeService,
} from "@/services/extra.service";
import { collectServicePayment } from "@/services/transaction.service";
import { notifyReceiptByToken } from "@/services/collect.service";
import {
  createCharger,
  createChargingPlan,
  setChargerStatus,
  startCharging,
  stopCharging,
} from "@/services/charging.service";
import { updateEnabledModules, updateTenantBank } from "@/services/tenant.service";
import { ALL_MODULES_ON, type EnabledModules } from "@/lib/modules";

export async function createServiceTypeAction(input: unknown): Promise<ActionResult> {
  try {
    await requireEnabledModule("dichVu");
    const { db, user } = await getTenantContext();
    if (!canEditVehicle(user.role)) throw new AppError("Bạn không thêm được dịch vụ.", "FORBIDDEN");
    const data = serviceTypeSchema.parse(input);
    await createServiceType(db, { tenantId: user.tenantId, userId: user.id }, data);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function deleteServiceTypeAction(id: string): Promise<ActionResult> {
  try {
    await requireEnabledModule("dichVu");
    const { db, user } = await getTenantContext();
    if (!canDelete(user.role)) throw new AppError("Bạn không xoá được.", "FORBIDDEN");
    await deleteServiceType(db, id);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function subscribeServiceAction(input: unknown): Promise<ActionResult> {
  try {
    await requireEnabledModule("dichVu");
    const { db, user } = await getTenantContext();
    if (!canEditVehicle(user.role)) throw new AppError("Bạn không đăng ký được.", "FORBIDDEN");
    const data = serviceSubSchema.parse(input);
    await subscribeService(db, { tenantId: user.tenantId, branchId: user.branchId, userId: user.id }, data);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function collectServiceAction(
  input: unknown,
): Promise<ActionResult<{ amountLabel: string; nextDueLabel: string; receiptUrl?: string }>> {
  try {
    await requireEnabledModule("dichVu");
    const { db, user } = await getTenantContext();
    if (!canCollect(user.role)) throw new AppError("Bạn không được thu tiền.", "FORBIDDEN");
    const data = collectTargetSchema.parse(input);
    if (!data.subscriptionId) throw new AppError("Thiếu đăng ký.", "VALIDATION");
    const result = await collectServicePayment(
      db,
      { tenantId: user.tenantId, branchId: user.branchId, userId: user.id },
      { subscriptionId: data.subscriptionId, method: data.method, note: data.note, imageUrl: data.imageUrl },
    );
    await notifyReceiptByToken(user.tenantId, result.receiptToken, result.amount, result.nextDueDate);
    return ok({
      amountLabel: formatVnd(result.amount),
      nextDueLabel: formatVnDate(result.nextDueDate),
      receiptUrl: result.receiptToken ? `/bien-lai/${result.receiptToken}` : undefined,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function createChargerAction(input: unknown): Promise<ActionResult> {
  try {
    await requireEnabledModule("sacDien");
    const { db, user } = await getTenantContext();
    if (!canEditVehicle(user.role)) throw new AppError("Bạn không thêm được trụ.", "FORBIDDEN");
    const data = chargerSchema.parse(input);
    await createCharger(db, { tenantId: user.tenantId, branchId: user.branchId, userId: user.id }, data);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function createChargingPlanAction(input: unknown): Promise<ActionResult> {
  try {
    await requireEnabledModule("sacDien");
    const { db, user } = await getTenantContext();
    if (!canEditVehicle(user.role)) throw new AppError("Bạn không thêm được gói sạc.", "FORBIDDEN");
    const data = chargingPlanSchema.parse(input);
    await createChargingPlan(db, { tenantId: user.tenantId }, data);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function markChargerBrokenAction(id: string, broken: boolean): Promise<ActionResult> {
  try {
    await requireEnabledModule("sacDien");
    const { db, user } = await getTenantContext();
    if (!canEditVehicle(user.role)) throw new AppError("Bạn không đổi trạng thái trụ.", "FORBIDDEN");
    await setChargerStatus(db, id, broken ? "HONG" : "RANH");
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function startChargeAction(input: unknown): Promise<ActionResult> {
  try {
    await requireEnabledModule("sacDien");
    const { db, user } = await getTenantContext();
    if (!canCollect(user.role)) throw new AppError("Bạn không bắt đầu sạc được.", "FORBIDDEN");
    const data = startChargeSchema.parse(input);
    await startCharging(db, { tenantId: user.tenantId, branchId: user.branchId, userId: user.id }, data);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function stopChargeAction(
  input: unknown,
): Promise<ActionResult<{ amountLabel: string; safetyWarning: boolean }>> {
  try {
    await requireEnabledModule("sacDien");
    const { db, user } = await getTenantContext();
    if (!canCollect(user.role)) throw new AppError("Bạn không kết thúc sạc được.", "FORBIDDEN");
    const data = stopChargeSchema.parse(input);
    const result = await stopCharging(
      db,
      { tenantId: user.tenantId, branchId: user.branchId, userId: user.id },
      data,
    );
    return ok({
      amountLabel: formatVnd(result.amount),
      safetyWarning: result.safetyWarning,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function saveModulesAction(input: EnabledModules): Promise<ActionResult> {
  try {
    const { user } = await getTenantContext();
    if (!canManageSettings(user.role)) throw new AppError("Chỉ chủ bãi mới đổi loại hình.", "FORBIDDEN");
    await updateEnabledModules(user.tenantId, { ...ALL_MODULES_ON, ...input, xeThang: true });
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function saveBankAction(input: {
  bankBin: string;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
}): Promise<ActionResult> {
  try {
    const { user } = await getTenantContext();
    if (!canManageSettings(user.role)) {
      throw new AppError("Chỉ chủ bãi mới đổi số tài khoản.", "FORBIDDEN");
    }
    await updateTenantBank(user.tenantId, input);
    return ok();
  } catch (error) {
    return fail(error);
  }
}
