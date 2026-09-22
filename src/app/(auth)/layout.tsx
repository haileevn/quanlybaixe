import { Toaster } from "@/components/ui/sonner";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center bg-[#FBF6EE] px-5 py-10">
      <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-amber-700">
        Sổ bãi xe
      </p>
      {children}
      <Toaster />
    </div>
  );
}
