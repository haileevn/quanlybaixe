import Link from "next/link";
import { BottomNav } from "@/components/layout/BottomNav";

export function AppShell({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-[#FBF6EE] pb-24">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[#0F4C5C]/10 bg-[#0F4C5C] px-4 py-3 text-white">
        <div>
          <p className="text-xs font-medium tracking-wide text-amber-200">Sổ bãi xe</p>
          <h1 className="text-xl font-bold">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {action}
          {title !== "Cài đặt" ? (
            <Link
              href="/cai-dat"
              className="rounded-full bg-white/15 px-3 py-2 text-sm font-semibold"
            >
              Cài đặt
            </Link>
          ) : null}
        </div>
      </header>
      <main className="px-4 py-4">{children}</main>
      <BottomNav />
    </div>
  );
}
