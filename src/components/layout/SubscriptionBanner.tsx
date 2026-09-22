import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock } from "lucide-react";
import { formatVnDate, daysUntil } from "@/lib/datetime";

export function SubscriptionBanner({
  isExpired,
  endsAt,
  planName,
}: {
  isExpired: boolean;
  endsAt: Date;
  planName: string;
}) {
  const days = daysUntil(endsAt);

  if (isExpired) {
    return (
      <div className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-red-200 bg-red-600 px-4 py-2.5 text-xs text-white shadow-md">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300 animate-pulse" />
          <span>
            <strong>Hết hạn dùng thử:</strong> Gói <strong>{planName}</strong> đã hết hạn ({formatVnDate(endsAt)}). Vui lòng đăng ký gói mới để tiếp tục.
          </span>
        </div>
        <Link
          href="/goi-dich-vu"
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-red-700 shadow hover:bg-neutral-100"
        >
          Nâng cấp ngay
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  if (days <= 3 && days >= 0) {
    return (
      <div className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-amber-300 bg-amber-500 px-4 py-2 text-xs text-white shadow-sm">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-amber-100" />
          <span>
            Gói <strong>{planName}</strong> sắp hết hạn trong <strong>{days === 0 ? "hôm nay" : `${days} ngày`}</strong> ({formatVnDate(endsAt)}).
          </span>
        </div>
        <Link
          href="/goi-dich-vu"
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-amber-50"
        >
          Gia hạn
        </Link>
      </div>
    );
  }

  return null;
}
