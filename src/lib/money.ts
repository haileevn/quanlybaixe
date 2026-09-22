import { Prisma } from "@prisma/client";

export function toDecimal(value: number | string | Prisma.Decimal) {
  return new Prisma.Decimal(value);
}

export function toNumber(value: Prisma.Decimal | number | string) {
  return new Prisma.Decimal(value).toNumber();
}

/** Hiển thị 1.500.000 đ */
export function formatVnd(value: Prisma.Decimal | number | string | null | undefined) {
  const n = value == null ? 0 : new Prisma.Decimal(value).toNumber();
  const rounded = Math.round(n);
  const grouped = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${rounded < 0 ? "-" : ""}${grouped} đ`;
}

/** Nhận "1.500.000" hoặc "1500000" → số nguyên đồng. */
export function parseVndInput(raw: string) {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) {
    return 0;
  }
  return Number.parseInt(digits, 10);
}

export function formatVndInput(raw: string) {
  const n = parseVndInput(raw);
  if (!n) {
    return "";
  }
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
