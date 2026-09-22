/** Lấy chữ số từ số điện thoại Việt Nam. */
export function phoneDigits(raw: string) {
  return raw.replace(/\D/g, "");
}

/**
 * Chuẩn hoá về 84xxxxxxxxx (11 số) để gửi SMS.
 * Nhận 090..., +84..., 84...
 */
export function toSmsNumber(raw: string) {
  let digits = phoneDigits(raw);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("840") && digits.length === 12) {
    digits = `84${digits.slice(3)}`;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    digits = `84${digits.slice(1)}`;
  }
  if (digits.length === 9) {
    digits = `84${digits}`;
  }
  if (digits.startsWith("84") && digits.length === 11) {
    return digits;
  }
  return null;
}

/** Hiển thị 09xxxxxxxx */
export function formatVnPhone(raw: string) {
  const sms = toSmsNumber(raw);
  if (!sms) return raw.trim();
  return `0${sms.slice(2)}`;
}

export function isVnMobile(raw: string) {
  return Boolean(toSmsNumber(raw));
}
