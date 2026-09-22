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
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Nhập mật khẩu hiện tại"),
  newPassword: z.string().min(6, "Mật khẩu mới tối thiểu 6 ký tự"),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, "Họ tên tối thiểu 2 ký tự"),
  phone: z.string().optional(),
});

export const adminUpdateUserSchema = z.object({
  userId: z.string().min(1, "Thiếu ID người dùng"),
  name: z.string().min(2, "Họ tên tối thiểu 2 ký tự"),
  email: z.string().email("Email không hợp lệ"),
  phone: z.string().optional(),
  isSuperAdmin: z.boolean().optional(),
  isActive: z.boolean().optional(),
  newPassword: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự").optional().or(z.literal("")),
});

export const adminResetPasswordSchema = z.object({
  userId: z.string().min(1, "Thiếu ID người dùng"),
  newPassword: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});
