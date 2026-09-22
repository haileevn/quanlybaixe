"use client";

import Link from "next/link";
import { useState, useTransition, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { resetPasswordAction, sendOtpAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { touchBtnClass, touchInputClass } from "@/lib/utils";
import { Mail, KeyRound, Lock, ArrowLeft, CheckCircle2 } from "lucide-react";

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";

  const [step, setStep] = useState<"EMAIL" | "OTP">("EMAIL");
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [devOtp, setDevOtp] = useState<string | undefined>();
  const [countdown, setCountdown] = useState(0);
  const [pending, start] = useTransition();
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOtp = () => {
    if (!email.trim() || !email.includes("@")) {
      toast.error("Vui lòng nhập địa chỉ email hợp lệ");
      return;
    }

    start(async () => {
      const result = await sendOtpAction({ email });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setDevOtp(result.data.devOtp);
      setStep("OTP");
      setCountdown(60);
      toast.success("Mã OTP đã được gửi về Gmail của bạn!");
    });
  };

  const handleResetPassword = () => {
    if (!otp.trim() || otp.trim().length !== 6) {
      toast.error("Vui lòng nhập mã OTP gồm 6 chữ số");
      return;
    }
    if (password.length < 6) {
      toast.error("Mật khẩu mới phải có tối thiểu 6 ký tự");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }

    start(async () => {
      const result = await resetPasswordAction({ email, otp: otp.trim(), password });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setIsSuccess(true);
      toast.success("Đặt lại mật khẩu thành công!");
    });
  };

  if (isSuccess) {
    return (
      <div className="space-y-4 text-center py-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900">Đổi mật khẩu thành công!</h2>
        <p className="text-sm text-neutral-600">
          Mật khẩu mới của tài khoản <strong>{email}</strong> đã được cập nhật. Bạn có thể đăng nhập ngay bây giờ.
        </p>
        <div className="pt-4">
          <Link
            href="/dang-nhap"
            className={touchBtnClass + " inline-flex items-center justify-center bg-[#0F4C5C] text-white"}
          >
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-black text-[#0F4C5C]">Quên mật khẩu</h1>
        <p className="text-xs text-neutral-500 mt-1">
          {step === "EMAIL"
            ? "Nhập email tài khoản để nhận mã OTP xác thực qua Gmail"
            : `Nhập mã OTP 6 số đã gửi tới ${email}`}
        </p>
      </div>

      <div className="space-y-4">
        {step === "EMAIL" ? (
          <>
            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-700">Email tài khoản</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="email"
                  className={touchInputClass + " pl-10"}
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <Button
              className={touchBtnClass + " bg-[#0F4C5C] text-white hover:bg-[#0c3c49]"}
              disabled={pending}
              onClick={handleSendOtp}
            >
              {pending ? "Đang gửi mã..." : "Gửi mã xác thực qua Gmail"}
            </Button>
          </>
        ) : (
          <>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200/80 p-3 text-xs text-emerald-800 flex items-start gap-2">
              <Mail className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
              <div>
                Đã gửi mã OTP tới <strong>{email}</strong>. Vui lòng kiểm tra hộp thư đến (hoặc thư mục Spam/Rác).
              </div>
            </div>

            {devOtp && (
              <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 font-mono">
                Mã thử nghiệm (Môi trường Dev): <strong>{devOtp}</strong>
              </p>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-700">Mã xác thực OTP (6 số)</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  maxLength={6}
                  className={touchInputClass + " pl-10 tracking-widest font-mono text-center font-bold text-lg"}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-700">Mật khẩu mới</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="password"
                  className={touchInputClass + " pl-10"}
                  placeholder="Tối thiểu 6 ký tự"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-700">Xác nhận mật khẩu mới</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="password"
                  className={touchInputClass + " pl-10"}
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <Button
              className={touchBtnClass + " bg-[#0F4C5C] text-white hover:bg-[#0c3c49]"}
              disabled={pending}
              onClick={handleResetPassword}
            >
              {pending ? "Đang lưu..." : "Lưu mật khẩu mới"}
            </Button>

            <div className="flex items-center justify-between text-xs text-neutral-500 pt-1">
              <button
                type="button"
                onClick={() => setStep("EMAIL")}
                className="hover:text-[#0F4C5C] font-semibold"
              >
                ← Đổi email khác
              </button>

              <button
                type="button"
                disabled={countdown > 0 || pending}
                onClick={handleSendOtp}
                className={`font-semibold ${
                  countdown > 0 ? "text-neutral-400 cursor-not-allowed" : "text-[#0F4C5C] hover:underline"
                }`}
              >
                {countdown > 0 ? `Gửi lại sau (${countdown}s)` : "Gửi lại mã OTP"}
              </button>
            </div>
          </>
        )}

        <div className="border-t border-neutral-100 pt-3">
          <Link
            href="/dang-nhap"
            className="flex items-center justify-center gap-1 text-center text-sm font-semibold text-[#0F4C5C] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Về trang đăng nhập
          </Link>
        </div>
      </div>
    </>
  );
}

export default function ForgotPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-neutral-500">Đang tải...</div>}>
      <ForgotPasswordContent />
    </Suspense>
  );
}
