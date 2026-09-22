import { cacheGet, cacheIncr, cacheSet } from "@/lib/redis";
import { AppError } from "@/lib/errors";

export async function assertRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
  message = "Bạn thao tác hơi nhanh. Đợi một lát rồi thử lại.",
) {
  const count = await cacheIncr(key, windowSeconds);
  if (count > max) {
    throw new AppError(message, "FORBIDDEN");
  }
}

export async function storeOtp(email: string, otp: string) {
  await cacheSet(`otp:${email.toLowerCase()}`, otp, 10 * 60);
}

export async function readOtp(email: string) {
  return cacheGet(`otp:${email.toLowerCase()}`);
}

export function randomOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
