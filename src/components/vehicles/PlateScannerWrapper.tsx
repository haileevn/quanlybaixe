"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { RefreshCw } from "lucide-react";

const PlateScannerView = dynamic(
  () => import("@/components/vehicles/PlateScannerView").then((mod) => mod.PlateScannerView),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center min-h-[350px] rounded-3xl bg-neutral-900 text-white p-8 gap-3">
        <RefreshCw className="size-8 animate-spin text-amber-400" />
        <p className="text-sm font-semibold text-neutral-200">Đang nạp trình quét biển số...</p>
      </div>
    ),
  }
);

export function PlateScannerWrapper() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] rounded-3xl bg-neutral-900 text-white p-8 gap-3">
        <RefreshCw className="size-8 animate-spin text-amber-400" />
        <p className="text-sm font-semibold text-neutral-200">Đang nạp trình quét biển số...</p>
      </div>
    );
  }

  return <PlateScannerView />;
}
