"use server";

import { AppError, fail, ok, type ActionResult } from "@/lib/errors";
import { getTenantContext } from "@/lib/session";
import { canManageSettings } from "@/lib/rbac";
import {
  cancelPendingPayment,
  createSaasPayment,
  getPaymentQr,
  getPaymentStatus,
  buildTenantCollectQr,
} from "@/services/billing.service";

export async function createBillingPaymentAction(
  planId: string,
  addons: string[] = [],
  months = 1,
): Promise<ActionResult<{ paymentId: string }>> {
  try {
    const { user } = await getTenantContext();
    if (!canManageSettings(user.role)) {
      throw new AppError("Chỉ chủ bãi mới thanh toán gói.", "FORBIDDEN");
    }
    const payment = await createSaasPayment(user.tenantId, user.id, planId, addons, months);
    return ok({ paymentId: payment.id });
  } catch (error) {
    return fail(error);
  }
}

export async function loadPaymentQrAction(paymentId: string) {
  try {
    const { user } = await getTenantContext();
    const data = await getPaymentQr(paymentId, user.tenantId);
    return ok({
      qrDataUrl: data.qrDataUrl,
      bank: data.bank,
      amount: Number(data.payment.amount),
      transferContent: data.payment.transferContent ?? "",
      planName: data.planName,
      status: data.payment.status,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function paymentStatusAction(paymentId: string) {
  try {
    const { user } = await getTenantContext();
    const status = await getPaymentStatus(paymentId, user.tenantId);
    return ok({ status });
  } catch (error) {
    return fail(error);
  }
}

export async function cancelPaymentAction(paymentId: string): Promise<ActionResult> {
  try {
    const { user } = await getTenantContext();
    if (!canManageSettings(user.role)) {
      throw new AppError("Chỉ chủ bãi mới huỷ khoản này.", "FORBIDDEN");
    }
    await cancelPendingPayment(user.tenantId, paymentId);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function collectQrAction(input: {
  amount: number;
  addInfo: string;
}): Promise<
  ActionResult<{
    qrDataUrl: string;
    accountNo: string;
    accountName: string;
    bankName: string;
    amount: number;
    addInfo: string;
  }>
> {
  try {
    const { user } = await getTenantContext();
    const data = await buildTenantCollectQr(user.tenantId, { ...input, branchId: user.branchId });
    return ok({
      qrDataUrl: data.qrDataUrl,
      accountNo: data.bank.accountNo,
      accountName: data.bank.accountName,
      bankName: data.bank.bankName,
      amount: data.amount,
      addInfo: data.addInfo,
    });
  } catch (error) {
    return fail(error);
  }
}
