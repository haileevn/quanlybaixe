"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, Bike, CalendarClock, Camera, House } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Trang chủ", icon: House },
  { href: "/xe-thang", label: "Xe tháng", icon: Bike },
  { href: "/quet-bien-so", label: "Quét biển", icon: Camera, highlight: true },
  { href: "/sap-toi-han", label: "Tới hạn", icon: CalendarClock },
  { href: "/thu-tien", label: "Thu tiền", icon: Banknote },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-[#0F4C5C]/15 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold transition",
                  active
                    ? "text-[#0F4C5C] font-bold"
                    : "text-neutral-500 hover:text-neutral-900",
                  item.highlight && !active && "text-[#0F4C5C]/80",
                )}
              >
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full transition",
                    item.highlight && active
                      ? "bg-[#0F4C5C] text-amber-300"
                      : item.highlight
                      ? "bg-amber-100 text-[#0F4C5C]"
                      : "",
                  )}
                >
                  <Icon className="size-5" />
                </div>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
