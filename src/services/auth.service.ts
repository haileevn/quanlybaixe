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
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "https://quanlybaixe.h2t.vn";
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #0F4C5C; margin: 0; font-size: 22px;">HỆ THỐNG QUẢN LÝ BÃI XE</h2>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Yêu cầu đặt lại mật khẩu</p>
      </div>
      <p style="color: #334155; font-size: 15px;">Xin chào <strong>${user.name}</strong>,</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">Hệ thống vừa nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>${email}</strong>. Đây là mã xác thực OTP của bạn:</p>
      <div style="text-align: center; margin: 25px 0; background-color: #FBF6EE; border: 2px dashed #0F4C5C; padding: 18px; border-radius: 8px;">
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0F4C5C;">${otp}</span>
      </div>
      <p style="color: #64748b; font-size: 13px; margin-bottom: 20px;">⏰ Mã này có hiệu lực trong vòng <strong>10 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
      <div style="text-align: center; margin-top: 25px;">
        <a href="${appUrl}/quen-mat-khau?email=${encodeURIComponent(email)}" style="display: inline-block; background-color: #0F4C5C; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">Mở trang đặt lại mật khẩu</a>
      </div>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">Nếu bạn không yêu cầu thay đổi mật khẩu, vui lòng bỏ qua email này hoặc liên hệ quản trị viên.</p>
    </div>
  `;

  const result = await sendMail({
    to: email,
    subject: "Mã xác thực đặt lại mật khẩu - Quản Lý Bãi Xe",
    text: `Mã xác thực của bạn là: ${otp}. Mã hết hạn sau 10 phút.`,
    html: htmlContent,
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

export async function changeUserPassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("Không tìm thấy tài khoản.", "NOT_FOUND");
  }

  const valid = await argon2.verify(user.passwordHash, currentPassword);
  if (!valid) {
    throw new AppError("Mật khẩu hiện tại không chính xác.", "VALIDATION");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await argon2.hash(newPassword) },
  });
}

export async function updateUserProfile(userId: string, data: { name: string; phone?: string }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("Không tìm thấy tài khoản.", "NOT_FOUND");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name.trim(),
      phone: data.phone ? data.phone.trim() : null,
    },
  });
}

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isSuperAdmin: true,
      isActive: true,
      createdAt: true,
    },
  });
  if (!user) {
    throw new AppError("Không tìm thấy tài khoản.", "NOT_FOUND");
  }
  return user;
}
