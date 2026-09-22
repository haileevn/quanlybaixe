"use server";

import { AppError, fail, ok, type ActionResult } from "@/lib/errors";
import { getTenantContext } from "@/lib/session";
import { canCollect } from "@/lib/rbac";
import { collectPaymentSchema } from "@/lib/validators/business";
import { collectVehiclePayment } from "@/services/transaction.service";
import { notifyReceiptByToken } from "@/services/collect.service";
import { formatVnd } from "@/lib/money";
import { formatVnDate } from "@/lib/datetime";

export async function collectPaymentAction(input: unknown): Promise<
  ActionResult<{ amountLabel: string; nextDueLabel: string; receiptUrl?: string }>
> {
  try {
    const { db, user } = await getTenantContext();
    if (!canCollect(user.role)) {
      throw new AppError("Bạn không được ghi nhận thu tiền.", "FORBIDDEN");
    }
    const data = collectPaymentSchema.parse(input);
    const result = await collectVehiclePayment(
      db,
      { tenantId: user.tenantId, branchId: user.branchId, userId: user.id },
      data,
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
