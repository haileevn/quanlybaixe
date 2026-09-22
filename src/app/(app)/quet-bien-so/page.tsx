import { AppShell } from "@/components/layout/AppShell";
import { PlateScannerWrapper } from "@/components/vehicles/PlateScannerWrapper";
import { getTenantContext } from "@/lib/session";

export default async function PlateScanPage() {
  await getTenantContext();

  return (
    <AppShell title="Quét biển số">
      <PlateScannerWrapper />
    </AppShell>
  );
}


