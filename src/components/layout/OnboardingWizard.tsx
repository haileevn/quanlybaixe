"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { completeOnboardingAction } from "@/actions/onboarding";
import { Button } from "@/components/ui/button";
import { MODULE_OPTIONS, type EnabledModules } from "@/lib/modules";
import { cn, touchBtnClass, touchInputClass } from "@/lib/utils";

export function OnboardingWizard({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [tenantName, setTenantName] = useState(defaultName);
  const [branchName, setBranchName] = useState(defaultName);
  const [modules, setModules] = useState<EnabledModules>({
    xeThang: true,
    phongTro: false,
    matBang: false,
    sacDien: false,
    dichVu: false,
  });
  const [pending, start] = useTransition();

  return (
    <div className="space-y-5">
      <p className="text-sm font-semibold text-amber-800">Bước {step + 1} / 2</p>
      {step === 0 ? (
        <>
          <label className="block space-y-2">
            <span className="text-lg font-bold">Bãi xe của bạn tên gì?</span>
            <input
              className={touchInputClass}
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-lg font-bold">Tên địa điểm / chi nhánh</span>
            <input
              className={touchInputClass}
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
            />
          </label>
          <Button className={touchBtnClass} onClick={() => setStep(1)}>
            Tiếp tục
          </Button>
        </>
      ) : (
        <>
          <h2 className="text-lg font-bold">Bạn đang kinh doanh gì?</h2>
          <p className="text-base text-neutral-600">
            Chỉ bật những phần bạn dùng. Có thể đổi sau.
          </p>
          <div className="space-y-3">
            {MODULE_OPTIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                disabled={item.key === "xeThang"}
                onClick={() =>
                  setModules((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                }
                className={cn(
                  "w-full rounded-2xl border-2 p-4 text-left",
                  modules[item.key]
                    ? "border-[#0F4C5C] bg-[#0F4C5C]/8"
                    : "border-neutral-200 bg-white",
                )}
              >
                <p className="text-lg font-bold">{item.title}</p>
                <p className="text-sm text-neutral-600">{item.hint}</p>
              </button>
            ))}
          </div>
          <Button
            className={touchBtnClass}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await completeOnboardingAction({
                  tenantName,
                  branchName,
                  ...modules,
                });
                if (!result.ok) {
                  toast.error(result.message);
                  return;
                }
                router.push("/");
                router.refresh();
              })
            }
          >
            {pending ? "Đang lưu..." : "Bắt đầu dùng"}
          </Button>
        </>
      )}
    </div>
  );
}
