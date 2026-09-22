import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { nowVn } from "@/lib/datetime";
import { getActiveSubscription } from "./plan.service";

export interface PlateScanQuotaInfo {
  usedToday: number;
  maxDaily: number;
  usedMonth: number;
  maxMonthly: number;
  isUnlimited: boolean;
  isExpired: boolean;
  planName: string;
  planCode: string;
  endsAt: Date;
}

/**
 * Lấy thông tin hạn mức quét biển số của bãi xe (hôm nay & trong tháng)
 */
export async function getPlateScanQuota(tenantId: string): Promise<PlateScanQuotaInfo> {
  const sub = await getActiveSubscription(tenantId);
  const now = new Date();
  const isExpired = sub.status === "EXPIRED" || sub.endsAt < now;

  const plan = sub.plan;
  const isUnlimited = plan.maxDailyScans < 0 && plan.maxMonthlyScans < 0;

  const todayStr = nowVn().format("YYYY-MM-DD");
  const monthStr = nowVn().format("YYYY-MM");

  const [todayRecord, monthRecords] = await Promise.all([
    prisma.plateScanUsage.findUnique({
      where: {
        tenantId_scanDate: {
          tenantId,
          scanDate: todayStr,
        },
      },
    }),
    prisma.plateScanUsage.aggregate({
      where: {
        tenantId,
        scanMonth: monthStr,
      },
      _sum: {
        count: true,
      },
    }),
  ]);

  const usedToday = todayRecord?.count ?? 0;
  const usedMonth = monthRecords._sum.count ?? 0;

  return {
    usedToday,
    maxDaily: plan.maxDailyScans,
    usedMonth,
    maxMonthly: plan.maxMonthlyScans,
    isUnlimited,
    isExpired,
    planName: plan.name,
    planCode: plan.code,
    endsAt: sub.endsAt,
  };
}

/**
 * Kiểm tra tính hợp lệ và ghi nhận 1 lượt quét biển số
 * Ném lỗi nếu gói hết hạn hoặc vượt quá giới hạn ngày / tháng
 */
export async function checkAndRecordPlateScan(tenantId: string): Promise<PlateScanQuotaInfo> {
  const sub = await getActiveSubscription(tenantId);
  const now = new Date();

  if (sub.status === "EXPIRED" || sub.endsAt < now) {
    throw new AppError(
      "Gói dịch vụ hoặc thời hạn dùng thử của bạn đã hết hạn. Vui lòng đăng ký gói mới để tiếp tục quét biển số.",
      "PLAN_LIMIT",
      { isExpired: "1", planCode: sub.plan.code }
    );
  }

  const plan = sub.plan;
  const todayStr = nowVn().format("YYYY-MM-DD");
  const monthStr = nowVn().format("YYYY-MM");

  // Kiểm tra giới hạn ngày
  if (plan.maxDailyScans > 0) {
    const todayRecord = await prisma.plateScanUsage.findUnique({
      where: {
        tenantId_scanDate: {
          tenantId,
          scanDate: todayStr,
        },
      },
    });

    const usedToday = todayRecord?.count ?? 0;
    if (usedToday >= plan.maxDailyScans) {
      throw new AppError(
        `Tài khoản dùng thử đã đạt giới hạn tối đa ${plan.maxDailyScans} lượt quét/ngày. Vui lòng nâng cấp gói để quét không giới hạn.`,
        "PLAN_LIMIT",
        {
          limitType: "daily",
          maxLimit: plan.maxDailyScans,
          used: usedToday,
        }
      );
    }
  }

  // Kiểm tra giới hạn tháng
  if (plan.maxMonthlyScans > 0) {
    const monthRecords = await prisma.plateScanUsage.aggregate({
      where: {
        tenantId,
        scanMonth: monthStr,
      },
      _sum: {
        count: true,
      },
    });

    const usedMonth = monthRecords._sum.count ?? 0;
    if (usedMonth >= plan.maxMonthlyScans) {
      throw new AppError(
        `Tài khoản dùng thử đã đạt giới hạn tối đa ${plan.maxMonthlyScans} lượt quét/tháng. Vui lòng nâng cấp gói để quét không giới hạn.`,
        "PLAN_LIMIT",
        {
          limitType: "monthly",
          maxLimit: plan.maxMonthlyScans,
          used: usedMonth,
        }
      );
    }
  }

  // Ghi nhận tăng 1 lượt quét
  const updated = await prisma.plateScanUsage.upsert({
    where: {
      tenantId_scanDate: {
        tenantId,
        scanDate: todayStr,
      },
    },
    create: {
      tenantId,
      scanDate: todayStr,
      scanMonth: monthStr,
      count: 1,
    },
    update: {
      count: {
        increment: 1,
      },
    },
  });

  // Tính lại tổng số trong tháng sau khi tăng
  const monthRecordsAfter = await prisma.plateScanUsage.aggregate({
    where: {
      tenantId,
      scanMonth: monthStr,
    },
    _sum: {
      count: true,
    },
  });

  return {
    usedToday: updated.count,
    maxDaily: plan.maxDailyScans,
    usedMonth: monthRecordsAfter._sum.count ?? updated.count,
    maxMonthly: plan.maxMonthlyScans,
    isUnlimited: plan.maxDailyScans < 0 && plan.maxMonthlyScans < 0,
    isExpired: false,
    planName: plan.name,
    planCode: plan.code,
    endsAt: sub.endsAt,
  };
}
