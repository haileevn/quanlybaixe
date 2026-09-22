import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { Toaster } from "@/components/ui/sonner";
import { requireSuperAdmin } from "@/lib/session";
import { touchBtnClass } from "@/lib/utils";
import { getAdminStats } from "@/services/admin.service";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireSuperAdmin();
  const stats = await getAdminStats();

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-[#FBF6EE] pb-10">
      <header className="bg-[#0F4C5C] px-4 py-3 text-white">
        <p className="text-xs tracking-wide text-amber-200">Quản trị hệ thống</p>
        <h1 className="text-xl font-bold">Xin chào {admin.name}</h1>
        <nav className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
          <Link className="rounded-full bg-white/15 px-3 py-2 transition hover:bg-white/25" href="/admin">
            Tổng quan
          </Link>
          <Link className="relative rounded-full bg-white/15 px-3 py-2 transition hover:bg-white/25" href="/admin/thanh-toan">
            Duyệt tiền
            {stats.pendingPayments > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">
                {stats.pendingPayments}
              </span>
            )}
          </Link>
          <Link className="relative rounded-full bg-white/15 px-3 py-2 transition hover:bg-white/25" href="/admin/bai-xe">
            Bãi xe
            {stats.pendingTenants > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-neutral-900 animate-pulse">
                {stats.pendingTenants}
              </span>
            )}
          </Link>
          <Link className="rounded-full bg-white/15 px-3 py-2 transition hover:bg-white/25" href="/admin/goi">
            Gói
          </Link>
        </nav>
      </header>
      <main className="px-4 py-4">{children}</main>
      <form action={logoutAction} className="px-4">
        <button className={touchBtnClass + " bg-red-700 text-white"} type="submit">
          Đăng xuất
        </button>
      </form>
      <Toaster />
    </div>
  );
}
