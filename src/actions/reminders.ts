"use server";

import { AppError, fail, ok, type ActionResult } from "@/lib/errors";
import { getTenantContext } from "@/lib/session";
import { canManageSettings, canSendSms } from "@/lib/rbac";
import { bulkRemindSchema, customerSmsSchema } from "@/lib/validators/business";
import {
  sendBulkReminders,
  scanRemindersForTenant,
  sendCustomerSms,
} from "@/services/reminder.service";
import { updateReminderConfig } from "@/services/tenant.service";
import { DEFAULT_REMINDER_CONFIG } from "@/lib/modules";
import { assertRateLimit } from "@/lib/rate-limit";

export async function sendBulkRemindAction(
  input: unknown,
): Promise<ActionResult<{ sent: number; delivered: number; failed: number; configured: boolean }>> {
  try {
    const { user } = await getTenantContext();
    if (!canManageSettings(user.role) && user.role !== "MANAGER") {
      throw new AppError("Bạn không gửi được tin nhắc.", "FORBIDDEN");
    }
    await assertRateLimit(`sms-bulk:${user.tenantId}`, 8, 15 * 60, "Gửi hơi nhiều. Đợi 15 phút rồi thử lại.");
    const data = bulkRemindSchema.parse(input);
    const result = await sendBulkReminders({
      tenantId: user.tenantId,
      template: data.template,
      items: data.items.map((item) => ({
        ...item,
        nextDueDate: new Date(item.nextDueDate),
      })),
    });
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function sendCustomerSmsAction(
  input: unknown,
): Promise<ActionResult<{ delivered: boolean; configured: boolean }>> {
  try {
    const { user } = await getTenantContext();
    if (!canSendSms(user.role)) {
      throw new AppError("Bạn không gửi được tin nhắn.", "FORBIDDEN");
    }
    await assertRateLimit(`sms-one:${user.tenantId}`, 40, 15 * 60, "Gửi hơi nhiều. Đợi một lát rồi thử lại.");
    const data = customerSmsSchema.parse(input);
    const result = await sendCustomerSms({
      tenantId: user.tenantId,
      phone: data.phone,
      body: data.body,
    });
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function runReminderNowAction(): Promise<ActionResult<{ sent: number; sms: number }>> {
  try {
    const { user } = await getTenantContext();
    if (!canManageSettings(user.role)) {
      throw new AppError("Chỉ chủ bãi mới chạy nhắc hạn.", "FORBIDDEN");
    }
    const result = await scanRemindersForTenant(user.tenantId);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function saveReminderConfigAction(input: {
  daysBefore: number[];
  daysOverdue: number[];
  smsEnabled: boolean;
}): Promise<ActionResult> {
  try {
    const { user } = await getTenantContext();
    if (!canManageSettings(user.role)) {
      throw new AppError("Chỉ chủ bãi mới đổi lịch nhắc.", "FORBIDDEN");
    }
    await updateReminderConfig(user.tenantId, {
      daysBefore: input.daysBefore.length ? input.daysBefore : DEFAULT_REMINDER_CONFIG.daysBefore,
      daysOverdue: input.daysOverdue.length ? input.daysOverdue : DEFAULT_REMINDER_CONFIG.daysOverdue,
      smsEnabled: input.smsEnabled,
    });
    return ok();
  } catch (error) {
    return fail(error);
  }
}
