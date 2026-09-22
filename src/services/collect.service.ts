import { prisma } from "@/lib/prisma";
import { createTenantClient } from "@/lib/prisma-tenant";
import { AppError } from "@/lib/errors";
import { formatVnDate } from "@/lib/datetime";
import { formatVnd, toNumber } from "@/lib/money";
import { plateSearchKey } from "@/lib/plate";
import { phoneDigits } from "@/lib/phone";
import { SmsChannel } from "@/lib/notifications/channels";
import {
  collectKioskPayment,
  collectRoomPayment,
  collectServicePayment,
  collectVehiclePayment,
} from "@/services/transaction.service";
import { buildTenantCollectQr } from "@/services/billing.service";

function randomToken() {
  return `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 8)}`;
}

function monthsOf(value?: number) {
  return value && value >= 3 ? 3 : 1;
}

function appUrl() {
  return (process.env.APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3033").replace(/\/$/, "");
}

export function receiptUrl(token: string) {
  return `${appUrl()}/bien-lai/${token}`;
}

export function payUrl(token: string) {
  return `${appUrl()}/thanh-toan/${token}`;
}

async function sendReceiptSms(phone: string, tenantId: string, body: string) {
  try {
    await new SmsChannel().send({ tenantId, to: phone, title: "Biên lai", body });
  } catch {
    /* không chặn thu tiền nếu SMS lỗi */
  }
}

export async function notifyReceiptByToken(
  tenantId: string,
  receiptToken: string | null | undefined,
  amount: number,
  nextDueDate: Date,
) {
  if (!receiptToken) return;
  const invoice = await prisma.invoice.findFirst({
    where: { receiptToken, tenantId, deletedAt: null },
    include: { customer: true },
  });
  if (!invoice?.customer.phone) return;
  await sendReceiptSms(
    invoice.customer.phone,
    tenantId,
    `Đã thu ${formatVnd(amount)}. Hạn mới ${formatVnDate(nextDueDate)}. Biên lai: ${receiptUrl(receiptToken)}`,
  );
}

export async function lookupCustomerDue(input: { plateTail: string; phone: string }) {
  const tail = plateSearchKey(input.plateTail).slice(-3);
  const phone = phoneDigits(input.phone);
  if (tail.length < 3) {
    throw new AppError("Nhập 3 số cuối biển số.", "VALIDATION");
  }
  if (phone.length < 9) {
    throw new AppError("Nhập số điện thoại.", "VALIDATION");
  }
  const vehicles = await prisma.vehicle.findMany({
    where: {
      deletedAt: null,
      plateSearch: { endsWith: tail },
      customer: { phone: { contains: phone.slice(-9) } },
      contracts: { some: { status: "DANG_GUI", deletedAt: null } },
    },
    include: {
      customer: true,
      tenant: { select: { name: true, slug: true } },
      contracts: {
        where: { deletedAt: null, status: "DANG_GUI" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    take: 8,
  });
  return vehicles
    .filter((row) => row.contracts[0])
    .map((row) => ({
      vehicleId: row.id,
      tenantName: row.tenant.name,
      plateNumber: row.plateNumber,
      customerName: row.customer.name,
      phone: row.customer.phone,
      amount: toNumber(row.contracts[0].monthlyPrice),
      nextDueDate: row.contracts[0].nextDueDate,
      cycle: row.contracts[0].cycle,
    }));
}

export async function createVehiclePayIntent(input: {
  tenantId: string;
  branchId: string;
  vehicleId: string;
  months?: number;
}) {
  const months = monthsOf(input.months);
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: input.vehicleId, tenantId: input.tenantId, deletedAt: null },
    include: {
      customer: true,
      contracts: {
        where: { deletedAt: null, status: "DANG_GUI" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  const contract = vehicle?.contracts[0];
  if (!vehicle || !contract) {
    throw new AppError("Không tìm thấy xe đang gửi.", "NOT_FOUND");
  }
  const amount = toNumber(contract.monthlyPrice) * months;
  const transferContent = `XE ${vehicle.plateNumber.replace(/\s/g, "").slice(0, 10)} T${months}`.slice(0, 25);
  const existing = await prisma.collectIntent.findFirst({
    where: {
      tenantId: input.tenantId,
      vehicleId: vehicle.id,
      months,
      status: { in: ["PENDING", "PROOF"] },
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
  const intent =
    existing ??
    (await prisma.collectIntent.create({
      data: {
        tenantId: input.tenantId,
        branchId: vehicle.branchId,
        publicToken: randomToken(),
        source: "XE_THANG",
        vehicleId: vehicle.id,
        customerId: vehicle.customerId,
        months,
        amount,
        transferContent,
        isDemo: vehicle.isDemo,
      },
    }));
  const qr = await buildTenantCollectQr(input.tenantId, {
    amount,
    addInfo: intent.transferContent,
    branchId: vehicle.branchId,
  });
  return {
    token: intent.publicToken,
    payUrl: payUrl(intent.publicToken),
    months,
    transferContent: intent.transferContent,
    plateNumber: vehicle.plateNumber,
    customerName: vehicle.customer.name,
    phone: vehicle.customer.phone,
    ...qr,
    amount,
  };
}

export async function getPublicPayIntent(token: string) {
  const intent = await prisma.collectIntent.findFirst({
    where: { publicToken: token, deletedAt: null },
    include: { tenant: true },
  });
  if (!intent) {
    throw new AppError("Không tìm thấy khoản thanh toán.", "NOT_FOUND");
  }
  const qr =
    intent.status === "PAID"
      ? null
      : await buildTenantCollectQr(intent.tenantId, {
          amount: toNumber(intent.amount),
          addInfo: intent.transferContent,
          branchId: intent.branchId,
        });
  const vehicle = intent.vehicleId
    ? await prisma.vehicle.findFirst({
        where: { id: intent.vehicleId },
        select: { plateNumber: true },
      })
    : null;
  return { intent, qr, label: vehicle?.plateNumber ?? intent.transferContent };
}

export async function attachProof(token: string, proofImageUrl: string) {
  const intent = await prisma.collectIntent.findFirst({
    where: { publicToken: token, deletedAt: null, status: { in: ["PENDING", "PROOF"] } },
  });
  if (!intent) {
    throw new AppError("Không gửi được ảnh cho khoản này.", "NOT_FOUND");
  }
  await prisma.collectIntent.update({
    where: { id: intent.id },
    data: { proofImageUrl, status: "PROOF" },
  });
}

export async function fulfillCollectIntent(intentId: string, userId: string, method: "TIEN_MAT" | "CHUYEN_KHOAN") {
  const intent = await prisma.collectIntent.findFirst({
    where: { id: intentId, deletedAt: null },
  });
  if (!intent) {
    throw new AppError("Không tìm thấy khoản chờ.", "NOT_FOUND");
  }
  if (intent.status === "PAID") {
    const invoice = intent.invoiceId
      ? await prisma.invoice.findFirst({ where: { id: intent.invoiceId } })
      : null;
    return {
      amount: toNumber(intent.amount),
      nextDueDate: invoice?.periodEnd ?? new Date(),
      invoiceId: intent.invoiceId,
      receiptToken: invoice?.receiptToken ?? null,
    };
  }
  const db = createTenantClient(intent.tenantId);
  const ctx = { tenantId: intent.tenantId, branchId: intent.branchId, userId };
  let result: { amount: number; nextDueDate: Date; invoiceId?: string; receiptToken?: string };
  if (intent.vehicleId) {
    result = await collectVehiclePayment(db, ctx, {
      vehicleId: intent.vehicleId,
      method,
      months: intent.months,
      imageUrl: intent.proofImageUrl ?? undefined,
    });
  } else if (intent.roomId) {
    result = await collectRoomPayment(db, ctx, {
      roomId: intent.roomId,
      method,
      months: intent.months,
      imageUrl: intent.proofImageUrl ?? undefined,
    });
  } else if (intent.kioskId) {
    result = await collectKioskPayment(db, ctx, {
      kioskId: intent.kioskId,
      method,
      months: intent.months,
      imageUrl: intent.proofImageUrl ?? undefined,
    });
  } else if (intent.subscriptionId) {
    result = await collectServicePayment(db, ctx, {
      subscriptionId: intent.subscriptionId,
      method,
      imageUrl: intent.proofImageUrl ?? undefined,
    });
  } else {
    throw new AppError("Khoản thu thiếu dữ liệu.", "VALIDATION");
  }

  const invoice = result.invoiceId
    ? await prisma.invoice.findFirst({ where: { id: result.invoiceId } })
    : null;
  await prisma.collectIntent.update({
    where: { id: intent.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      invoiceId: result.invoiceId ?? null,
    },
  });

  const customer = await prisma.customer.findFirst({ where: { id: intent.customerId } });
  if (customer?.phone && invoice?.receiptToken) {
    await sendReceiptSms(
      customer.phone,
      intent.tenantId,
      `Đã thu ${formatVnd(result.amount)}. Hạn mới ${formatVnDate(result.nextDueDate)}. Biên lai: ${receiptUrl(invoice.receiptToken)}`,
    );
  }
  return { ...result, receiptToken: invoice?.receiptToken ?? result.receiptToken ?? null };
}

export async function confirmCollectByTransfer(input: { content: string; amount: number }) {
  const content = input.content.replace(/\s+/g, " ").trim().toUpperCase();
  const pending = await prisma.collectIntent.findMany({
    where: { status: { in: ["PENDING", "PROOF"] }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const intent = pending.find((row) => {
    const code = row.transferContent.toUpperCase();
    return Boolean(code) && content.includes(code) && input.amount + 1 >= toNumber(row.amount);
  });
  if (!intent) return null;
  const owner = await prisma.userTenant.findFirst({
    where: { tenantId: intent.tenantId, role: "OWNER", deletedAt: null },
  });
  if (!owner) return null;
  return fulfillCollectIntent(intent.id, owner.userId, "CHUYEN_KHOAN");
}

export async function getReceiptByToken(token: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { receiptToken: token, deletedAt: null },
    include: { customer: true, items: true, tenant: true, branch: true },
  });
  if (!invoice) {
    throw new AppError("Không tìm thấy biên lai.", "NOT_FOUND");
  }
  return invoice;
}

export async function listPendingProofs(tenantId: string) {
  return prisma.collectIntent.findMany({
    where: { tenantId, status: { in: ["PENDING", "PROOF"] }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}

export async function listBranchesForBank(tenantId: string) {
  return prisma.branch.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

export async function updateBranchBank(
  tenantId: string,
  branchId: string,
  input: { bankBin: string; bankName: string; bankAccountNo: string; bankAccountName: string },
) {
  const accountNo = input.bankAccountNo.replace(/\s/g, "");
  const branch = await prisma.branch.findFirst({ where: { id: branchId, tenantId, deletedAt: null } });
  if (!branch) {
    throw new AppError("Không tìm thấy bãi.", "NOT_FOUND");
  }
  if (!accountNo) {
    await prisma.branch.update({
      where: { id: branch.id },
      data: { bankBin: null, bankName: null, bankAccountNo: null, bankAccountName: null },
    });
    return;
  }
  if (accountNo.length < 6) {
    throw new AppError("Số tài khoản chưa đúng.", "VALIDATION");
  }
  await prisma.branch.update({
    where: { id: branch.id },
    data: {
      bankBin: input.bankBin,
      bankName: input.bankName,
      bankAccountNo: accountNo,
      bankAccountName: input.bankAccountName.trim().toUpperCase(),
    },
  });
}
