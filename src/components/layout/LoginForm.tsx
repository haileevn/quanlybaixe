"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { loginOtpAction, loginPasswordAction, sendOtpAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { cn, touchBtnClass, touchInputClass } from "@/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [devOtp, setDevOtp] = useState<string | undefined>();
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <label className="block space-y-2">
        <span className="text-base font-semibold">Email</span>
        <input
          className={touchInputClass}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      {mode === "password" ? (
        <label className="block space-y-2">
          <span className="text-base font-semibold">Mật khẩu</span>
          <input
            className={touchInputClass}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      ) : (
        <label className="block space-y-2">
          <span className="text-base font-semibold">Mã 6 số gửi về email</span>
          <input
            className={cn(touchInputClass, "tracking-[0.4em]")}
            inputMode="numeric"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
        </label>
      )}

      {devOtp ? (
        <p className="rounded-xl bg-amber-50 p-3 text-base">
          Chưa cấu hình email. Mã dùng thử: <b>{devOtp}</b>
        </p>
      ) : null}

      <Button
        type="button"
        className={touchBtnClass}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result =
              mode === "password"
                ? await loginPasswordAction({ email, password })
                : await loginOtpAction({ email, otp });
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            router.push(result.data?.redirectTo ?? "/");
            router.refresh();
          })
        }
      >
        {pending ? "Đang vào..." : "Đăng nhập"}
      </Button>

      <button
        type="button"
        className="w-full text-center text-base font-semibold text-[#0F4C5C] underline"
        onClick={() =>
          start(async () => {
            if (mode === "password") {
              const result = await sendOtpAction({ email });
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              setDevOtp(result.data.devOtp);
              setMode("otp");
              toast.success("Đã gửi mã. Kiểm tra email (hoặc mã hiện trên màn hình).");
            } else {
              setMode("password");
            }
          })
        }
      >
        {mode === "password" ? "Gửi mã vào email" : "Dùng mật khẩu"}
      </button>

      <div className="flex flex-col gap-2 text-center text-base">
        <Link href="/dang-ky" className="font-semibold text-[#0F4C5C]">
          Chưa có tài khoản? Đăng ký
        </Link>
        <Link href="/quen-mat-khau" className="text-neutral-600">
          Quên mật khẩu
        </Link>
        <Link href="/tra-cuu" className="text-neutral-600">
          Khách tra hạn xe
        </Link>
      </div>
    </div>
  );
}
