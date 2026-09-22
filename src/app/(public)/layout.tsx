import { Toaster } from "@/components/ui/sonner";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-[#FBF6EE] px-4 py-6">
      <p className="mb-4 text-xs font-semibold tracking-wide text-[#0F4C5C]">Sổ bãi xe</p>
      {children}
      <Toaster />
    </div>
  );
}
