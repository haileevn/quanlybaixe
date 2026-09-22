import { RegisterForm } from "@/components/layout/RegisterForm";

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-2 text-3xl font-black text-[#0F4C5C]">Tạo tài khoản</h1>
      <p className="mb-6 text-base text-neutral-600">Dùng thử 14 ngày, không cần thẻ.</p>
      <RegisterForm />
    </>
  );
}
