import QRCode from "qrcode";
import { PlanCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { nowVn, toVn, discountedTotal } from "@/lib/datetime";
import { toNumber } from "@/lib/money";
import { buildVietQrPayload, getSaasBank, resolveCollectBank } from "@/lib/vietqr";
import {
  parseAddonCodes,
  parseEnabledModules,
  mergePaidAddons,
  type AddonModuleKey,
} from "@/lib/modules";
import { writeAudit } from "@/services/audit.service";
import { getActiveSubscription } from "@/services/plan.service";

export async function listPlansForBilling() {
  return prisma.plan.findMany({ orderBy: { monthlyPrice: "asc" } });
}

export async function listActiveAddons() {
  return prisma.planAddon.findMany({
    where: { isActive: true },
    orderBy: { monthlyPrice: "asc" },
  });
}

export function parsePaidAddons(value: unknown) {
  return parseAddonCodes(value);
}

export async function listTenantPayments(tenantId: string) {
  return prisma.payment.findMany({
    where: { tenantId, deletedAt: null },
    include: { subscription: { include: { plan: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

async function sumAddonPrices(codes: AddonModuleKey[]) {
  if (codes.length === 0) return 0;
  const rows = await prisma.planAddon.findMany({
    where: { code: { in: codes }, isActive: true },
  });
  return rows.reduce((sum, row) => sum + toNumber(row.monthlyPrice), 0);
}

async function pickPlanByAmount(available: number, preferredId: string) {
  const preferred = await prisma.plan.findUnique({ where: { id: preferredId } });
  const paid = await prisma.plan.findMany({
    where: { code: { in: [PlanCode.CO_BAN, PlanCode.NANG_CAO] } },
    orderBy: { monthlyPrice: "desc" },
  });
  const best = paid.find((plan) => toNumber(plan.monthlyPrice) <= available);
  if (best && preferred && toNumber(best.monthlyPrice) > toNumber(preferred.monthlyPrice)) {
    return best;
  }
  return preferred ?? best ?? null;
}

export async function createSaasPayment(
  tenantId: string,
  userId: string,
  planId: string,
  addonCodes: string[] = [],
  months = 1,
) {
  const addons = parseAddonCodes(addonCodes);
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    throw new AppError("Không tìm thấy gói.", "NOT_FOUND");
  }
  if (plan.code === PlanCode.DOANH_NGHIEP) {
    throw new AppError("Gói Doanh nghiệp vui lòng liên hệ. Không thanh toán trên app.", "VALIDATION");
  }
  if (plan.code === PlanCode.DUNG_THU) {
    throw new AppError("Gói dùng thử không gia hạn bằng chuyển khoản.", "VALIDATION");
  }
  const billingMonths = months >= 12 ? 12 : months >= 3 ? 3 : 1;
  const pending = await prisma.payment.findFirst({
    where: { tenantId, status: "PENDING", deletedAt: null },
  });
  if (pending) {
    throw new AppError("Bạn đang có khoản chờ duyệt. Đợi hoặc huỷ trước khi tạo mới.", "CONFLICT");
  }
  const addonTotal = await sumAddonPrices(addons);
  const amount = discountedTotal(toNumber(plan.monthlyPrice) + addonTotal, billingMonths);
  if (amount <= 0) {
    throw new AppError("Số tiền gói chưa hợp lệ.", "VALIDATION");
  }
  const sub = await getActiveSubscription(tenantId);
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const transferContent = `QLBX ${tenant.slug.slice(0, 10)} ${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const payment = await prisma.payment.create({
    data: {
      tenantId,
      subscriptionId: sub.id,
      targetPlanId: plan.id,
      amount,
      months: billingMonths,
      status: "PENDING",
      transferContent,
      addons,
    },
  });
  await writeAudit({
    tenantId,
    userId,
    action: "TAO_THANH_TOAN_GOI",
    entityType: "Payment",
    entityId: payment.id,
    after: { plan: plan.name, amount, addons },
  });

  if (process.env.SAAS_AUTO_APPROVE === "1") {
    await applySaasPayment(payment.id, userId, "Tự duyệt (máy dev)");
  }

  return payment;
}

export async function getPaymentQr(paymentId: string, tenantId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, tenantId, deletedAt: null },
  });
  if (!payment) {
    throw new AppError("Không tìm thấy khoản thanh toán.", "NOT_FOUND");
  }
  const bank = getSaasBank();
  const payload = buildVietQrPayload({
    bankBin: bank.bankBin,
    accountNo: bank.accountNo,
    amount: toNumber(payment.amount),
    addInfo: payment.transferContent ?? undefined,
  });
  const qrDataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 280 });
  const plan = await prisma.plan.findUnique({ where: { id: payment.targetPlanId } });
  return {
    payment,
    planName: plan?.name ?? "Gói",
    addons: parseAddonCodes(payment.addons),
    bank,
    qrDataUrl,
  };
}

export async function cancelPendingPayment(tenantId: string, paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, tenantId, status: "PENDING", deletedAt: null },
  });
  if (!payment) {
    throw new AppError("Không huỷ được khoản này.", "NOT_FOUND");
  }
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "REJECTED", note: "Chủ bãi huỷ" },
  });
}

export async function applySaasPayment(paymentId: string, reviewerId: string | null, note?: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, status: "PENDING", deletedAt: null },
  });
  if (!payment) {
    throw new AppError("Không tìm thấy khoản chờ duyệt.", "NOT_FOUND");
  }
  const addons = parseAddonCodes(payment.addons);
  const addonTotal = await sumAddonPrices(addons);
  const billingMonths = payment.months >= 12 ? 12 : payment.months >= 3 ? 3 : 1;
  const plan =
    billingMonths === 1
      ? await pickPlanByAmount(toNumber(payment.amount) - addonTotal, payment.targetPlanId)
      : await prisma.plan.findUnique({ where: { id: payment.targetPlanId } });
  if (!plan) {
    throw new AppError("Gói không còn.", "NOT_FOUND");
  }
  const sub = await prisma.subscription.findFirst({
    where: { id: payment.subscriptionId, deletedAt: null },
  });
  if (!sub) {
    throw new AppError("Không tìm thấy gói đang dùng.", "NOT_FOUND");
  }
  const tenant = await prisma.tenant.findFirst({
    where: { id: payment.tenantId, deletedAt: null },
  });
  if (!tenant) {
    throw new AppError("Không tìm thấy bãi xe.", "NOT_FOUND");
  }
  const currentEnd = toVn(sub.endsAt);
  const base = nowVn().isAfter(currentEnd) ? nowVn() : currentEnd;
  const endsAt = base.add(billingMonths, "month").toDate();
  const paidAddons = [...new Set([...parsePaidAddons(sub.paidAddons), ...addons])];
  const enabledModules = mergePaidAddons(parseEnabledModules(tenant.enabledModules), paidAddons);

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "APPROVED",
        reviewedByUserId: reviewerId,
        reviewedAt: new Date(),
        note: note ?? payment.note,
        targetPlanId: plan.id,
      },
    }),
    prisma.subscription.update({
      where: { id: sub.id },
      data: {
        planId: plan.id,
        status: "ACTIVE",
        endsAt,
        paidAddons,
      },
    }),
    prisma.tenant.update({
      where: { id: tenant.id },
      data: { enabledModules },
    }),
  ]);
  await writeAudit({
    tenantId: payment.tenantId,
    userId: reviewerId ?? undefined,
    action: "DUYET_THANH_TOAN",
    entityType: "Payment",
    entityId: payment.id,
    after: { plan: plan.name, endsAt: endsAt.toISOString(), addons: paidAddons },
  });
  return { planName: plan.name, endsAt };
}

export async function approvePayment(adminUserId: string, paymentId: string) {
  await applySaasPayment(paymentId, adminUserId);
}

export async function confirmSaasByTransfer(input: { content: string; amount: number }) {
  const content = input.content.replace(/\s+/g, " ").trim().toUpperCase();
  if (!content || input.amount <= 0) {
    throw new AppError("Thiếu nội dung hoặc số tiền chuyển khoản.", "VALIDATION");
  }
  const pending = await prisma.payment.findMany({
    where: { status: "PENDING", deletedAt: null, transferContent: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const payment = pending.find((row) => {
    const code = (row.transferContent ?? "").toUpperCase();
    return Boolean(code) && content.includes(code) && input.amount + 1 >= toNumber(row.amount);
  });
  if (!payment) {
    throw new AppError("Không khớp khoản chờ. Kiểm tra nội dung chuyển khoản.", "NOT_FOUND");
  }
  return applySaasPayment(payment.id, null, "Tự khớp chuyển khoản");
}

export async function rejectPayment(adminUserId: string, paymentId: string, note?: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, status: "PENDING", deletedAt: null },
  });
  if (!payment) {
    throw new AppError("Không tìm thấy khoản chờ duyệt.", "NOT_FOUND");
  }
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "REJECTED",
      reviewedByUserId: adminUserId,
      reviewedAt: new Date(),
      note,
    },
  });
  await writeAudit({
    tenantId: payment.tenantId,
    userId: adminUserId,
    action: "TU_CHOI_THANH_TOAN",
    entityType: "Payment",
    entityId: payment.id,
  });
}

export async function listPendingPayments() {
  return prisma.payment.findMany({
    where: { status: "PENDING", deletedAt: null },
    include: { tenant: true, subscription: { include: { plan: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function buildTenantCollectQr(
  tenantId: string,
  input: { amount: number; addInfo: string; branchId?: string },
) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
  });
  if (!tenant) {
    throw new AppError("Không tìm thấy bãi xe.", "NOT_FOUND");
  }
  const branch = input.branchId
    ? await prisma.branch.findFirst({ where: { id: input.branchId, tenantId, deletedAt: null } })
    : await prisma.branch.findFirst({ where: { tenantId, deletedAt: null }, orderBy: { createdAt: "asc" } });
  const bank = resolveCollectBank(tenant, branch);
  if (!bank) {
    throw new AppError("Vào Cài đặt điền số tài khoản để hiện mã QR thu tiền.", "VALIDATION");
  }
  const amount = Math.round(input.amount);
  if (amount <= 0) {
    throw new AppError("Số tiền chưa hợp lệ.", "VALIDATION");
  }
  const addInfo = input.addInfo.replace(/\s+/g, " ").trim().slice(0, 25);
  const payload = buildVietQrPayload({
    bankBin: bank.bankBin,
    accountNo: bank.accountNo,
    amount,
    addInfo,
  });
  const qrDataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 280 });
  return { qrDataUrl, bank, amount, addInfo };
}

export async function getPaymentStatus(paymentId: string, tenantId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, tenantId, deletedAt: null },
    select: { status: true },
  });
  return payment?.status ?? null;
}
