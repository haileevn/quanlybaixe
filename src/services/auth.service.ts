import argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { sendMail } from "@/lib/mail";
import { assertRateLimit, randomOtp, storeOtp, readOtp } from "@/lib/rate-limit";

export async function requestEmailOtp(emailRaw: string, ip: string) {
  const email = emailRaw.trim().toLowerCase();
  await assertRateLimit(`otp:ip:${ip}`, 10, 10 * 60);
  await assertRateLimit(`otp:email:${email}`, 3, 10 * 60, "Bạn đã gửi mã quá nhiều. Thử lại sau 10 phút.");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("Không tìm thấy tài khoản với email này.", "NOT_FOUND");
  }

  const otp = randomOtp();
  await storeOtp(email, otp);
  const result = await sendMail({
    to: email,
    subject: "Mã đăng nhập bãi xe",
    text: `Mã của bạn là ${otp}. Mã hết hạn sau 10 phút. Không chia sẻ mã này.`,
  });
  return { delivered: result.delivered, devOtp: result.delivered ? undefined : otp };
}

export async function resetPasswordWithOtp(input: {
  email: string;
  otp: string;
  password: string;
}) {
  const email = input.email.trim().toLowerCase();
  const stored = await readOtp(email);
  if (!stored || stored !== input.otp) {
    throw new AppError("Mã không đúng hoặc đã hết hạn.", "VALIDATION");
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("Không tìm thấy tài khoản.", "NOT_FOUND");
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await argon2.hash(input.password) },
  });
}
