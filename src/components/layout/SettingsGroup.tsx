"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsGroup({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#0F4C5C]/8">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-[#0F4C5C]">{title}</p>
          {hint ? <p className="truncate text-sm text-neutral-500">{hint}</p> : null}
        </div>
        <ChevronDown className={cn("size-5 shrink-0 text-neutral-400 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="border-t border-[#0F4C5C]/8 px-4 py-4">{children}</div>
      ) : (
        <div className="hidden">{children}</div>
      )}
    </section>
  );
}
