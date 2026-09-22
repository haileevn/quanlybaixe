"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { signIn, signOut, auth } from "@/lib/auth";
import { AppError, fail, ok, type ActionResult } from "@/lib/errors";
import {
  loginSchema,
  otpLoginSchema,
  otpRequestSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validators/auth";
import { requestEmailOtp, resetPasswordWithOtp } from "@/services/auth.service";
import { registerOwner } from "@/services/tenant.service";
import { assertRateLimit } from "@/lib/rate-limit";

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function mapAuthError(error: unknown): never {
  if (error && typeof error === "object" && "digest" in error) {
    const digest = String((error as { digest?: string }).digest ?? "");
    if (digest.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
  }
  if (error instanceof AuthError) {
    throw new AppError("Email hoặc mật khẩu chưa đúng.", "UNAUTHORIZED");
  }
  throw error;
}

export async function registerAction(input: unknown): Promise<ActionResult> {
  try {
    const data = registerSchema.parse(input);
    await registerOwner(data);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function loginPasswordAction(
  input: unknown,
): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const data = loginSchema.parse(input);
    await assertRateLimit(
      `login:${data.email.toLowerCase()}`,
      5,
      15 * 60,
      "Sai quá nhiều lần. Đợi 15 phút rồi thử lại.",
    );
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });
      if (result && typeof result === "object" && "error" in result && result.error) {
        throw new AppError("Email hoặc mật khẩu chưa đúng.", "UNAUTHORIZED");
      }
    } catch (error) {
      mapAuthError(error);
    }
    return ok({
      redirectTo: (await auth())?.user?.isSuperAdmin ? "/admin" : "/",
    });
  } catch (error) {
    return fail(error);
  }
}

export async function sendOtpAction(input: unknown): Promise<ActionResult<{ devOtp?: string }>> {
  try {
    const data = otpRequestSchema.parse(input);
    const result = await requestEmailOtp(data.email, await clientIp());
    return ok({ devOtp: result.devOtp });
  } catch (error) {
    return fail(error);
  }
}

export async function loginOtpAction(
  input: unknown,
): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const data = otpLoginSchema.parse(input);
    try {
      const result = await signIn("otp", {
        email: data.email,
        otp: data.otp,
        redirect: false,
      });
      if (result && typeof result === "object" && "error" in result && result.error) {
        throw new AppError("Mã không đúng hoặc đã hết hạn.", "UNAUTHORIZED");
      }
    } catch (error) {
      if (error instanceof AuthError) {
        throw new AppError("Mã không đúng hoặc đã hết hạn.", "UNAUTHORIZED");
      }
      throw error;
    }
    return ok({
      redirectTo: (await auth())?.user?.isSuperAdmin ? "/admin" : "/",
    });
  } catch (error) {
    return fail(error);
  }
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  try {
    const data = resetPasswordSchema.parse(input);
    await resetPasswordWithOtp(data);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/dang-nhap" });
}
