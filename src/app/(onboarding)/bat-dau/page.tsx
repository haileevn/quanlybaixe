import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/layout/OnboardingWizard";
import { Toaster } from "@/components/ui/sonner";
import { getTenantContext } from "@/lib/session";
import { getTenantOrThrow } from "@/services/tenant.service";

export default async function OnboardingPage() {
  const { user } = await getTenantContext();
  const tenant = await getTenantOrThrow(user.tenantId);
  if (tenant.onboardingCompleted) {
    redirect("/");
  }
  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-[#FBF6EE] px-5 py-8">
      <p className="text-sm font-semibold uppercase tracking-widest text-amber-700">Lần đầu dùng</p>
      <h1 className="mb-6 text-3xl font-black text-[#0F4C5C]">Thiết lập bãi xe</h1>
      <OnboardingWizard defaultName={tenant.name} />
      <Toaster />
    </div>
  );
}
