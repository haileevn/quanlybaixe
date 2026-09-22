import { redirect } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { getTenantContext } from "@/lib/session";
import { getTenantOrThrow } from "@/services/tenant.service";
import { getActiveSubscription } from "@/services/plan.service";
import { SubscriptionBanner } from "@/components/layout/SubscriptionBanner";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getTenantContext();
  const tenant = await getTenantOrThrow(user.tenantId);

  // 1. Kiểm tra duyệt tài khoản
  if (tenant.approvalStatus !== "APPROVED") {
    redirect("/cho-duyet");
  }

  // 2. Kiểm tra onboarding
  if (!tenant.onboardingCompleted) {
    redirect("/bat-dau");
  }

  // 3. Kiểm tra hạn gói đăng ký
  let isExpired = false;
  let endsAt = new Date();
  let planName = "Dùng thử";

  try {
    const sub = await getActiveSubscription(user.tenantId);
    endsAt = sub.endsAt;
    planName = sub.plan.name;
    isExpired = sub.status === "EXPIRED" || sub.endsAt < new Date();
  } catch {
    isExpired = true;
  }

  return (
    <>
      <SubscriptionBanner isExpired={isExpired} endsAt={endsAt} planName={planName} />
      {children}
      <Toaster />
    </>
  );
}
