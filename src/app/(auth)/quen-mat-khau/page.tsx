"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resetPasswordAction, sendOtpAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { touchBtnClass, touchInputClass } from "@/lib/utils";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [devOtp, setDevOtp] = useState<string | undefined>();
  const [pending, start] = useTransition();

  return (
    <>
      <h1 className="mb-2 text-3xl font-black text-[#0F4C5C]">Đặt lại mật khẩu</h1>
      <div className="space-y-4">
        <input
          className={touchInputClass}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button
          variant="outline"
          className={touchBtnClass}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await sendOtpAction({ email });
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              setDevOtp(result.data.devOtp);
              toast.success("Đã gửi mã.");
            })
          }
        >
          Gửi mã
        </Button>
        {devOtp ? <p className="rounded-xl bg-amber-50 p-3">Mã dùng thử: {devOtp}</p> : null}
        <input
          className={touchInputClass}
          placeholder="Mã 6 số"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
        />
        <input
          className={touchInputClass}
          type="password"
          placeholder="Mật khẩu mới"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button
          className={touchBtnClass}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await resetPasswordAction({ email, otp, password });
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              toast.success("Đã đổi mật khẩu. Hãy đăng nhập.");
            })
          }
        >
          Lưu mật khẩu mới
        </Button>
        <Link href="/dang-nhap" className="block text-center font-semibold text-[#0F4C5C]">
          Về đăng nhập
        </Link>
      </div>
    </>
  );
}
