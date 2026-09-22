import { redirect } from "next/navigation";
import { LoginForm } from "@/components/layout/LoginForm";
import { auth } from "@/lib/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect(session.user.isSuperAdmin ? "/admin" : "/");
  }
  return (
    <>
      <h1 className="mb-2 text-3xl font-black text-[#0F4C5C]">Đăng nhập</h1>
      <p className="mb-6 text-base text-neutral-600">Vào sổ để thu tiền, xem xe tới hạn.</p>
      <LoginForm />
    </>
  );
}
