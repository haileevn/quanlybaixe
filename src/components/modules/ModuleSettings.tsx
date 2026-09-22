"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveModulesAction } from "@/actions/extras";
import { Button } from "@/components/ui/button";
import { MODULE_OPTIONS, type EnabledModules } from "@/lib/modules";
import { cn, touchBtnClass } from "@/lib/utils";

export function ModuleSettings({ initial }: { initial: EnabledModules }) {
  const router = useRouter();
  const [modules, setModules] = useState(initial);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-600">Bật phần nào thì sổ hiện phần đó. Đổi gói ở mục Gói đang dùng.</p>
      {MODULE_OPTIONS.map((item) => (
        <button
          key={item.key}
          type="button"
          disabled={item.key === "xeThang"}
          onClick={() => setModules((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
          className={cn(
            "w-full rounded-2xl border-2 p-4 text-left",
            modules[item.key] ? "border-[#0F4C5C] bg-[#0F4C5C]/8" : "border-neutral-200",
          )}
        >
          <p className="text-lg font-bold">{item.title}</p>
          <p className="text-sm text-neutral-600">{item.hint}</p>
        </button>
      ))}
      <Button
        className={touchBtnClass}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await saveModulesAction(modules);
            if (!result.ok) toast.error(result.message);
            else {
              toast.success("Đã lưu loại hình.");
              router.refresh();
            }
          })
        }
      >
        Lưu loại hình
      </Button>
    </div>
  );
}
