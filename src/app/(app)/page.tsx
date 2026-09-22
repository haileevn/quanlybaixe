import Link from "next/link";
import { Camera } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DueBadge } from "@/components/vehicles/DueBadge";
import { formatVnd } from "@/lib/money";
import { getTenantContext } from "@/lib/session";
import { getDashboard } from "@/services/dashboard.service";
import { canViewProfit, canViewReports } from "@/lib/rbac";
import { dueItemHref } from "@/services/due.service";
import { getTenantOrThrow } from "@/services/tenant.service";
import { MODULE_HREF, MODULE_OPTIONS, parseEnabledModules } from "@/lib/modules";
import { getDashboardExtras, occupancyLabel } from "@/services/report.service";

export default async function DashboardPage() {
  const { db, user } = await getTenantContext();
  const data = await getDashboard(db, user.tenantId);
  const extras = await getDashboardExtras(db);
  const tenant = await getTenantOrThrow(user.tenantId);
  const modules = parseEnabledModules(tenant.enabledModules);
  const showReports = canViewReports(user.role);
  const showProfit = canViewProfit(user.role);

  return (
    <AppShell title="Hôm nay">
      <p className="mb-4 text-base text-neutral-600">Xin chào {user.name}</p>

      <section className="rounded-3xl bg-[#0F4C5C] p-5 text-white shadow-md">
        <p className="text-sm font-medium text-amber-200">Hôm nay thu bao nhiêu?</p>
        <p className="mt-1 text-4xl font-black tracking-tight">{formatVnd(data.todayIncome)}</p>
        <p className="mt-2 text-sm text-white/80">{data.activeVehicles} xe đang gửi</p>
      </section>

      {/* Nút hành động nhanh: Quét biển số xử lý ảnh */}
      <Link
        href="/quet-bien-so"
        className="mt-3 flex items-center justify-between rounded-3xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 p-4 text-[#0F4C5C] shadow-sm hover:opacity-95 active:scale-[0.99] transition border border-amber-500/20"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#0F4C5C] text-amber-300 shadow-sm">
            <Camera className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-[#0F4C5C] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                Gói đặc biệt
              </span>
              <span className="text-xs font-bold text-[#0F4C5C]/80">Xử lý ảnh</span>
            </div>
            <p className="text-lg font-black leading-tight text-[#0F4C5C] mt-0.5">
              Quét biển số xe vào / ra
            </p>
          </div>
        </div>
        <div className="rounded-full bg-[#0F4C5C] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs">
          Quét ngay
        </div>
      </Link>

      {showReports ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {showProfit ? (
            <div className="rounded-2xl bg-white p-4">
              <p className="text-sm text-neutral-600">Thu tháng này</p>
              <p className="text-xl font-black">{formatVnd(extras.monthIncome)}</p>
              <p className="text-sm text-neutral-600">Tháng trước {formatVnd(extras.prevIncome)}</p>
            </div>
          ) : null}
          <div className="rounded-2xl bg-white p-4">
            <p className="text-sm text-neutral-600">Đang nợ</p>
            <p className="text-xl font-black">{formatVnd(extras.debtTotal)}</p>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <p className="text-sm text-neutral-600">Phòng đang thuê</p>
            <p className="text-base font-bold">{occupancyLabel(extras.roomsRented, extras.rooms)}</p>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <p className="text-sm text-neutral-600">Mặt bằng đang thuê</p>
            <p className="text-base font-bold">{occupancyLabel(extras.kiosksRented, extras.kiosks)}</p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/thu-chi" className="rounded-2xl bg-white p-4 font-bold ring-1 ring-[#0F4C5C]/10">
          Thu — Chi
        </Link>
        <Link href="/cong-no" className="rounded-2xl bg-white p-4 font-bold ring-1 ring-[#0F4C5C]/10">
          Công nợ
        </Link>
        {showReports ? (
          <Link href="/bao-cao" className="rounded-2xl bg-white p-4 font-bold ring-1 ring-[#0F4C5C]/10">
            Báo cáo
          </Link>
        ) : null}
        {showProfit ? (
          <Link href="/so-quy" className="rounded-2xl bg-white p-4 font-bold ring-1 ring-[#0F4C5C]/10">
            Sổ quỹ
          </Link>
        ) : null}
        <Link href="/goi-dich-vu" className="rounded-2xl bg-white p-4 font-bold ring-1 ring-[#0F4C5C]/10">
          Gói dịch vụ
        </Link>
        {MODULE_OPTIONS.filter((item) => item.key !== "xeThang" && modules[item.key]).map((item) => (
          <Link
            key={item.key}
            href={MODULE_HREF[item.key]}
            className="rounded-2xl bg-white p-4 font-bold ring-1 ring-[#0F4C5C]/10"
          >
            {item.title}
          </Link>
        ))}
      </div>

      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold">Ai sắp tới hạn đóng tiền?</h2>
          <Link href="/sap-toi-han" className="text-sm font-semibold text-[#0F4C5C]">
            Xem hết
          </Link>
        </div>
        <div className="space-y-3">
          {data.upcoming.length === 0 ? (
            <p className="rounded-2xl bg-white p-4 text-neutral-600">7 ngày tới chưa có hạn nào.</p>
          ) : (
            data.upcoming.slice(0, 5).map((row) => (
              <Link
                key={row.targetId}
                href={dueItemHref(row)}
                className="block rounded-2xl bg-white p-4 ring-1 ring-[#0F4C5C]/10"
              >
                <p className="text-xl font-black">{row.label}</p>
                <p className="text-base">{row.customerName} · {row.sourceLabel}</p>
                <DueBadge date={row.nextDueDate} amount={row.amount} />
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-lg font-bold">Ai đang nợ?</h2>
        <div className="space-y-3">
          {data.overdue.length === 0 ? (
            <p className="rounded-2xl bg-white p-4 text-neutral-600">Không ai đang nợ. Tốt!</p>
          ) : (
            data.overdue.slice(0, 5).map((row) => (
              <Link
                key={row.targetId}
                href={dueItemHref(row)}
                className="block rounded-2xl bg-white p-4 ring-1 ring-red-200"
              >
                <p className="text-xl font-black">{row.label}</p>
                <p className="text-base">{row.customerName} · {row.sourceLabel}</p>
                <DueBadge date={row.nextDueDate} amount={row.amount} />
              </Link>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}
