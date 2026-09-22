import { daysUntil, formatVnDate } from "@/lib/datetime";
import { formatVnd } from "@/lib/money";
import { cn } from "@/lib/utils";

export function dueTone(date: Date) {
  const days = daysUntil(date);
  if (days < -3) return "red";
  if (days < 0) return "yellow";
  return "green";
}

export function DueBadge({ date, amount }: { date: Date; amount?: number }) {
  const days = daysUntil(date);
  const tone = dueTone(date);
  const label =
    days === 0
      ? "Hôm nay"
      : days > 0
        ? `Còn ${days} ngày`
        : `Quá hạn ${Math.abs(days)} ngày`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(
          "rounded-full px-3 py-1 text-sm font-bold",
          tone === "green" && "bg-emerald-100 text-emerald-800",
          tone === "yellow" && "bg-amber-100 text-amber-900",
          tone === "red" && "bg-red-100 text-red-800",
        )}
      >
        {label}
      </span>
      <span className="text-sm text-neutral-600">{formatVnDate(date)}</span>
      {amount != null ? (
        <span className="text-base font-bold text-[#0F4C5C]">{formatVnd(amount)}</span>
      ) : null}
    </div>
  );
}
