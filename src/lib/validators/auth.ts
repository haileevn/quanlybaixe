import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(1, "Nhập mật khẩu"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Nhập họ tên"),
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
});

export const otpRequestSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
});

export const otpLoginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  otp: z.string().regex(/^\d{6}$/, "Mã gồm 6 số"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  otp: z.string().regex(/^\d{6}$/, "Mã gồm 6 số"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
});
