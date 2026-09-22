"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { loginPasswordAction, registerAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { touchBtnClass, touchInputClass } from "@/lib/utils";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <label className="block space-y-2">
        <span className="text-base font-semibold">Họ tên</span>
        <input className={touchInputClass} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Email</span>
        <input
          className={touchInputClass}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="block space-y-2">
        <span className="text-base font-semibold">Mật khẩu (tối thiểu 8 ký tự)</span>
        <input
          className={touchInputClass}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <Button
        className={touchBtnClass}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const created = await registerAction({ name, email, password });
            if (!created.ok) {
              toast.error(created.message);
              return;
            }
            const logged = await loginPasswordAction({ email, password });
            if (!logged.ok) {
              toast.success("Đã tạo tài khoản. Hãy đăng nhập.");
              router.push("/dang-nhap");
              return;
            }
            router.push("/bat-dau");
            router.refresh();
          })
        }
      >
        {pending ? "Đang tạo..." : "Tạo tài khoản"}
      </Button>
      <Link href="/dang-nhap" className="block text-center text-base font-semibold text-[#0F4C5C]">
        Đã có tài khoản? Đăng nhập
      </Link>
    </div>
  );
}
