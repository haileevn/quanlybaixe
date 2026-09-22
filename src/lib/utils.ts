import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const touchInputClass =
  "h-14 w-full rounded-xl border-2 border-input bg-white px-4 text-lg text-foreground";

export const touchBtnClass = "h-14 w-full text-base font-semibold rounded-xl";
