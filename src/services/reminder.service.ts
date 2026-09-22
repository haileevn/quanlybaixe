import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { daysUntil, formatVnDate, vnStartOfDay } from "@/lib/datetime";
import { formatVnd } from "@/lib/money";
import { parseReminderConfig } from "@/lib/modules";
import { isSmsConfigured } from "@/lib/sms";
import { toSmsNumber } from "@/lib/phone";
import { InAppChannel, EmailChannel, SmsChannel } from "@/lib/notifications/channels";
import { listDueForTenantRaw } from "@/services/due.service";

function kindFromDays(days: number) {
  if (days > 0) return `TRUOC_${days}`;
  if (days === 0) return "DUNG_NGAY";
  return `QUA_HAN_${Math.abs(days)}`;
}

function messageFor(item: {
  customerName: string;
  label: string;
  amount: number;
  nextDueDate: Date;
  days: number;
}) {
  const han = formatVnDate(item.nextDueDate);
  const money = formatVnd(item.amount);
  if (item.days > 0) {
    return `Chào ${item.customerName}, ${item.label} còn ${item.days} ngày nữa tới hạn đóng ${money} (hạn ${han}).`;
  }
  if (item.days === 0) {
    return `Chào ${item.customerName}, hôm nay hạn đóng ${money} cho ${item.label}.`;
  }
  return `Chào ${item.customerName}, ${item.label} đã quá hạn ${Math.abs(item.days)} ngày. Số tiền ${money}, hạn ${han}.`;
}

export function applyTemplate(
  template: string,
  item: { customerName: string; label: string; amount: number; nextDueDate: Date },
) {
  return template
    .replaceAll("{tên}", item.customerName)
    .replaceAll("{biển số}", item.label)
    .replaceAll("{mục}", item.label)
    .replaceAll("{số tiền}", formatVnd(item.amount))
    .replaceAll("{hạn}", formatVnDate(item.nextDueDate));
}

export function defaultCustomerSms(item: {
  customerName: string;
  label: string;
  amount: number;
  nextDueDate: Date;
}) {
  return applyTemplate(
    "Chào {tên}, {mục} tới hạn đóng {số tiền} vào ngày {hạn}. Nhờ đóng giúp ạ.",
    item,
  );
}

const inApp = new InAppChannel();
const email = new EmailChannel();
const sms = new SmsChannel();

export async function scanRemindersForTenant(tenantId: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
  });
  if (!tenant) return { sent: 0, sms: 0 };
  const config = parseReminderConfig(tenant.reminderConfig);
  const items = await listDueForTenantRaw(tenantId);
  const today = vnStartOfDay();
  const owner = await prisma.userTenant.findFirst({
    where: { tenantId, role: "OWNER", deletedAt: null },
    include: { user: true },
  });
  let sent = 0;
  let smsSent = 0;

  for (const item of items) {
    const days = daysUntil(item.nextDueDate);
    const matchBefore = config.daysBefore.includes(days);
    const matchOverdue = days < 0 && config.daysOverdue.includes(Math.abs(days));
    if (!matchBefore && !matchOverdue) continue;

    const kind = kindFromDays(days);
    const already = await prisma.reminder.findFirst({
      where: {
        tenantId,
        targetId: item.targetId,
        kind,
        remindAt: { gte: today.toDate(), lte: today.endOf("day").toDate() },
        deletedAt: null,
      },
    });
    if (already) continue;

    const body = messageFor({ ...item, days });
    await prisma.reminder.create({
      data: {
        tenantId,
        targetType: item.targetType,
        targetId: item.targetId,
        kind,
        remindAt: today.toDate(),
        sentAt: new Date(),
      },
    });

    await inApp.send({
      tenantId,
      to: item.phone,
      title: "Nhắc hạn đóng tiền",
      body,
    });

    if (config.smsEnabled && toSmsNumber(item.phone)) {
      const result = await sms.send({
        tenantId,
        to: item.phone,
        title: "Nhắc hạn đóng tiền",
        body,
      });
      if (result.delivered) smsSent += 1;
    }

    if (owner?.user.email) {
      await email.send({
        tenantId,
        to: owner.user.email,
        title: `Nhắc hạn: ${item.label}`,
        body,
      });
    }
    sent += 1;
  }
  return { sent, sms: smsSent };
}

export async function scanAllTenantReminders() {
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null, onboardingCompleted: true },
    select: { id: true },
  });
  let sent = 0;
  let smsCount = 0;
  for (const tenant of tenants) {
    const result = await scanRemindersForTenant(tenant.id);
    sent += result.sent;
    smsCount += result.sms;
  }
  return { sent, sms: smsCount, tenants: tenants.length };
}

export async function sendBulkReminders(input: {
  tenantId: string;
  items: {
    customerName: string;
    phone: string;
    label: string;
    amount: number;
    nextDueDate: Date;
  }[];
  template: string;
}) {
  let sent = 0;
  let delivered = 0;
  let failed = 0;
  for (const item of input.items) {
    const body = applyTemplate(input.template, item);
    await inApp.send({
      tenantId: input.tenantId,
      to: item.phone,
      title: "Nhắc hạn đóng tiền",
      body,
    });
    const result = await sms.send({
      tenantId: input.tenantId,
      to: item.phone,
      title: "Nhắc hạn đóng tiền",
      body,
    });
    sent += 1;
    if (result.delivered) delivered += 1;
    else if (result.error) failed += 1;
  }
  return { sent, delivered, failed, configured: isSmsConfigured() };
}

export async function sendCustomerSms(input: {
  tenantId: string;
  phone: string;
  body: string;
}) {
  if (!toSmsNumber(input.phone)) {
    throw new AppError("Số điện thoại chưa đúng.", "VALIDATION");
  }
  const result = await sms.send({
    tenantId: input.tenantId,
    to: input.phone,
    title: "Nhắn khách",
    body: input.body.trim(),
  });
  if (result.error && isSmsConfigured()) {
    throw new AppError(result.error, "VALIDATION");
  }
  return { delivered: result.delivered, configured: isSmsConfigured() };
}

export async function listSmsLogs(tenantId: string, take = 8) {
  return prisma.notificationLog.findMany({
    where: { tenantId, channel: "sms", deletedAt: null },
    orderBy: { createdAt: "desc" },
    take,
  });
}
