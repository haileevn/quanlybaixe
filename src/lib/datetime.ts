import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.tz.setDefault("Asia/Ho_Chi_Minh");

export const VN_TZ = "Asia/Ho_Chi_Minh";

export function nowVn() {
  return dayjs().tz(VN_TZ);
}

export function toVn(date: Date | string) {
  return dayjs(date).tz(VN_TZ);
}

export function vnStartOfDay(date?: Date | string) {
  return (date ? dayjs(date).tz(VN_TZ) : nowVn()).startOf("day");
}

export function vnEndOfDay(date?: Date | string) {
  return (date ? dayjs(date).tz(VN_TZ) : nowVn()).endOf("day");
}

/** Lưu UTC tương ứng 00:00 giờ VN của một ngày. */
export function vnDateToUtc(date: Date | string) {
  return vnStartOfDay(date).utc().toDate();
}

export function formatVnDate(date: Date | string) {
  return toVn(date).format("DD/MM/YYYY");
}

export function formatVnDateTime(date: Date | string) {
  return toVn(date).format("DD/MM/YYYY HH:mm");
}

export function addBillingCycle(from: Date, cycle: "THANG" | "QUY") {
  const base = toVn(from);
  return (cycle === "QUY" ? base.add(3, "month") : base.add(1, "month")).toDate();
}

export function addBillingMonths(from: Date, cycle: "THANG" | "QUY", months: number) {
  const steps = Math.max(1, months);
  let current = from;
  for (let i = 0; i < steps; i += 1) {
    current = addBillingCycle(current, cycle);
  }
  return current;
}

/** 3 tháng giảm 8%, 12 tháng giảm 15%. Làm tròn 1.000 đ. */
export function discountedTotal(monthly: number, months: number) {
  const safeMonths = months >= 12 ? 12 : months >= 3 ? 3 : 1;
  const rate = safeMonths === 12 ? 0.85 : safeMonths === 3 ? 0.92 : 1;
  return Math.round((monthly * safeMonths * rate) / 1000) * 1000;
}

export function daysUntil(date: Date) {
  return vnStartOfDay(date).diff(vnStartOfDay(), "day");
}

export function parseVnDateInput(value: string) {
  const parsed = dayjs.tz(value, "YYYY-MM-DD", VN_TZ);
  if (!parsed.isValid()) {
    return vnDateToUtc(new Date());
  }
  return parsed.startOf("day").utc().toDate();
}
