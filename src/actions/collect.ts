"use server";

import { AppError, fail, ok, type ActionResult } from "@/lib/errors";
import { getTenantContext } from "@/lib/session";
import { canCollect, canManageSettings } from "@/lib/rbac";
import { assertRateLimit } from "@/lib/rate-limit";
import {
  attachProof,
  createVehiclePayIntent,
  fulfillCollectIntent,
  lookupCustomerDue,
  payUrl,
  updateBranchBank,
} from "@/services/collect.service";
import { formatVnDate } from "@/lib/datetime";
import { formatVnd } from "@/lib/money";

export async function lookupDueAction(input: { plateTail: string; phone: string }) {
  try {
    await assertRateLimit(`lookup:${input.phone}`, 12, 10 * 60, "Tra cứu hơi nhiều. Đợi một lát.");
    const rows = await lookupCustomerDue(input);
    return ok({ rows });
  } catch (error) {
    return fail(error);
  }
}

export async function createPublicPayAction(input: {
  plateTail: string;
  phone: string;
  vehicleId: string;
  months?: number;
}) {
  try {
    await assertRateLimit(`paylink:${input.phone}`, 8, 10 * 60);
    const rows = await lookupCustomerDue({ plateTail: input.plateTail, phone: input.phone });
    const row = rows.find((item) => item.vehicleId === input.vehicleId);
    if (!row) throw new AppError("Không khớp xe và số điện thoại.", "NOT_FOUND");
    const vehicle = await (await import("@/lib/prisma")).prisma.vehicle.findFirst({
      where: { id: row.vehicleId },
    });
    if (!vehicle) throw new AppError("Không tìm thấy xe.", "NOT_FOUND");
    const intent = await createVehiclePayIntent({
      tenantId: vehicle.tenantId,
      branchId: vehicle.branchId,
      vehicleId: vehicle.id,
      months: input.months,
    });
    return ok({ token: intent.token, payUrl: intent.payUrl });
  } catch (error) {
    return fail(error);
  }
}

export async function createStaffPayLinkAction(input: {
  vehicleId: string;
  months?: number;
}): Promise<ActionResult<{ token: string; payUrl: string; amount: number }>> {
  try {
    const { user } = await getTenantContext();
    if (!canCollect(user.role)) throw new AppError("Bạn không tạo được link thu tiền.", "FORBIDDEN");
    const intent = await createVehiclePayIntent({
      tenantId: user.tenantId,
      branchId: user.branchId,
      vehicleId: input.vehicleId,
      months: input.months,
    });
    return ok({ token: intent.token, payUrl: intent.payUrl, amount: intent.amount });
  } catch (error) {
    return fail(error);
  }
}

export async function confirmProofPaidAction(intentId: string): Promise<
  ActionResult<{ amountLabel: string; nextDueLabel: string; receiptUrl: string | null }>
> {
  try {
    const { user } = await getTenantContext();
    if (!canCollect(user.role)) throw new AppError("Bạn không duyệt được.", "FORBIDDEN");
    const result = await fulfillCollectIntent(intentId, user.id, "CHUYEN_KHOAN");
    return ok({
      amountLabel: formatVnd(result.amount ?? 0),
      nextDueLabel: result.nextDueDate ? formatVnDate(result.nextDueDate) : "",
      receiptUrl: result.receiptToken ? `/bien-lai/${result.receiptToken}` : null,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function saveBranchBankAction(input: {
  branchId: string;
  bankBin: string;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
}): Promise<ActionResult> {
  try {
    const { user } = await getTenantContext();
    if (!canManageSettings(user.role)) throw new AppError("Chỉ chủ bãi mới đổi số tài khoản.", "FORBIDDEN");
    await updateBranchBank(user.tenantId, input.branchId, input);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function saveProofByTokenAction(token: string, proofImageUrl: string): Promise<ActionResult> {
  try {
    await attachProof(token, proofImageUrl);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export { payUrl };
