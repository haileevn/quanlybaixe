"use server";

import { AppError, fail, ok, type ActionResult } from "@/lib/errors";
import { getTenantContext } from "@/lib/session";
import { canCollect, canRecordExpense, canViewProfit } from "@/lib/rbac";
import { cashEntrySchema } from "@/lib/validators/business";
import {
  closeCashbook,
  createExpenseCategory,
  ensureExpenseCategories,
  recordExpense,
  recordWalkInIncome,
} from "@/services/cash.service";

export async function recordWalkInAction(input: unknown): Promise<ActionResult> {
  try {
    const { db, user } = await getTenantContext();
    if (!canCollect(user.role)) {
      throw new AppError("Bạn không được ghi thu.", "FORBIDDEN");
    }
    const data = cashEntrySchema.parse(input);
    await recordWalkInIncome(
      db,
      { tenantId: user.tenantId, branchId: user.branchId, userId: user.id },
      data,
    );
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function recordExpenseAction(input: unknown): Promise<ActionResult> {
  try {
    const { db, user } = await getTenantContext();
    if (!canRecordExpense(user.role)) {
      throw new AppError("Bạn không được ghi chi.", "FORBIDDEN");
    }
    const data = cashEntrySchema.parse(input);
    if (!data.expenseCategoryId) {
      throw new AppError("Chọn loại khoản chi.", "VALIDATION");
    }
    await recordExpense(
      db,
      { tenantId: user.tenantId, branchId: user.branchId, userId: user.id },
      { ...data, expenseCategoryId: data.expenseCategoryId },
    );
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function addExpenseCategoryAction(name: string): Promise<ActionResult> {
  try {
    const { db, user } = await getTenantContext();
    if (!canRecordExpense(user.role)) {
      throw new AppError("Bạn không được thêm loại chi.", "FORBIDDEN");
    }
    await createExpenseCategory(db, user.tenantId, name);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function closeCashbookAction(): Promise<ActionResult> {
  try {
    const { db, user } = await getTenantContext();
    if (!canViewProfit(user.role)) {
      throw new AppError("Chỉ chủ bãi mới chốt sổ.", "FORBIDDEN");
    }
    await ensureExpenseCategories(user.tenantId);
    await closeCashbook(db, {
      tenantId: user.tenantId,
      branchId: user.branchId,
      userId: user.id,
    });
    return ok();
  } catch (error) {
    return fail(error);
  }
}
