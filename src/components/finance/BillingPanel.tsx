"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelPaymentAction, createBillingPaymentAction, paymentStatusAction } from "@/actions/billing";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";
import { discountedTotal, formatVnDate } from "@/lib/datetime";
import { touchBtnClass } from "@/lib/utils";

type PlanRow = {
  id: string;
  code: string;
  name: string;
  monthlyPrice: number;
};

type AddonRow = {
  code: string;
  name: string;
  monthlyPrice: number;
};

type PaymentRow = {
  id: string;
  amount: number;
  status: string;
  transferContent: string | null;
  createdAt: Date | string;
  planName: string;
};

export function BillingPanel({
  currentPlan,
  endsAt,
  plans,
  addons,
  prepaidAddons,
  payments,
  preselectAddon,
  qr,
}: {
  currentPlan: string;
  endsAt: Date;
  plans: PlanRow[];
  addons: AddonRow[];
  prepaidAddons: string[];
  payments: PaymentRow[];
  preselectAddon?: string;
  qr?: {
    paymentId: string;
    qrDataUrl: string;
    bankName: string;
    accountNo: string;
    accountName: string;
    transferContent: string;
    amount: number;
    planName: string;
    status: string;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const paidPlans = plans.filter((plan) => plan.code === "CO_BAN" || plan.code === "NANG_CAO");
  const [planId, setPlanId] = useState(paidPlans[0]?.id ?? "");
  const [months, setMonths] = useState(1);
  const [picked, setPicked] = useState<Record<string, boolean>>(() =>
    preselectAddon ? { [preselectAddon]: true } : {},
  );

  const selectedPlan = plans.find((plan) => plan.id === planId);
  const addonCodes = Object.entries(picked)
    .filter(([, on]) => on)
    .map(([code]) => code);
  const addonSum = addons
    .filter((row) => picked[row.code])
    .reduce((sum, row) => sum + row.monthlyPrice, 0);
  const total = discountedTotal((selectedPlan?.monthlyPrice ?? 0) + addonSum, months);

  useEffect(() => {
    if (!qr || qr.status !== "PENDING") return;
    const timer = setInterval(() => {
      void paymentStatusAction(qr.paymentId).then((result) => {
        if (result.ok && result.data.status === "APPROVED") {
          toast.success("Đã nhận tiền. Gói đã đổi.");
          router.push("/goi-dich-vu");
          router.refresh();
        }
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [qr, router]);

  const hint = useMemo(() => {
    if (qr?.status === "APPROVED") return "Đã nhận tiền. Gói đã được đổi.";
    return "Quét QR. Khi tiền vào, hệ thống tự đổi gói / thêm dịch vụ (nếu đã gắn webhook ngân hàng).";
  }, [qr?.status]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white p-5">
        <p className="text-sm font-semibold text-amber-700">Gói hiện tại</p>
        <p className="text-3xl font-black text-[#0F4C5C]">{currentPlan}</p>
        <p className="text-base">Hết hạn: {formatVnDate(endsAt)}</p>
        {prepaidAddons.length > 0 ? (
          <p className="mt-2 text-sm text-neutral-600">
            Dịch vụ thêm đã mở: {addons.filter((row) => prepaidAddons.includes(row.code)).map((row) => row.name).join(", ")}
          </p>
        ) : null}
      </div>

      {qr ? (
        <div className="space-y-3 rounded-2xl bg-white p-5 text-center">
          <p className="text-lg font-bold">
            {qr.status === "APPROVED" ? "Đã thanh toán" : `Chuyển khoản gói ${qr.planName}`}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.qrDataUrl} alt="Mã QR chuyển khoản" className="mx-auto w-56" />
          <p className="text-base">{qr.bankName}</p>
          <p className="text-lg font-bold">{qr.accountNo}</p>
          <p>{qr.accountName}</p>
          <p className="text-2xl font-black">{formatVnd(qr.amount)}</p>
          <p className="rounded-xl bg-amber-50 p-3 font-semibold">Nội dung: {qr.transferContent}</p>
          <p className="text-sm text-neutral-600">{hint}</p>
          {qr.status === "PENDING" ? (
            <Button
              variant="outline"
              className={touchBtnClass}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await cancelPaymentAction(qr.paymentId);
                  if (!result.ok) toast.error(result.message);
                  else {
                    toast.success("Đã huỷ khoản chờ.");
                    router.push("/goi-dich-vu");
                    router.refresh();
                  }
                })
              }
            >
              Huỷ khoản này
            </Button>
          ) : (
            <Link href="/goi-dich-vu" className="block font-semibold text-[#0F4C5C]">
              Quay lại gói
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-lg font-bold">Chọn gói</p>
          {paidPlans.map((plan) => (
            <label key={plan.id} className="flex items-center gap-3 rounded-2xl bg-white p-4">
              <input
                type="radio"
                className="size-5"
                name="plan"
                checked={planId === plan.id}
                onChange={() => setPlanId(plan.id)}
              />
              <span>
                <span className="block text-xl font-bold">{plan.name}</span>
                <span>{formatVnd(plan.monthlyPrice)} / tháng</span>
              </span>
            </label>
          ))}

          <p className="pt-2 text-lg font-bold">Thời hạn</p>
          {[1, 3, 12].map((n) => (
            <label key={n} className="flex items-center gap-3 rounded-2xl bg-white p-4">
              <input type="radio" className="size-5" name="months" checked={months === n} onChange={() => setMonths(n)} />
              <span className="font-bold">
                {n === 1 ? "1 tháng" : n === 3 ? "3 tháng (−8%)" : "12 tháng (−15%)"}
              </span>
            </label>
          ))}
          <p className="text-sm text-neutral-600">Tick phần muốn dùng. Tiền cộng vào QR, quét xong là mở.</p>
          {addons.map((row) => (
            <label key={row.code} className="flex items-center gap-3 rounded-2xl bg-white p-4">
              <input
                type="checkbox"
                className="size-5"
                checked={Boolean(picked[row.code])}
                onChange={(e) => setPicked((prev) => ({ ...prev, [row.code]: e.target.checked }))}
              />
              <span>
                <span className="block text-lg font-bold">{row.name}</span>
                <span>
                  {formatVnd(row.monthlyPrice)} / tháng
                  {prepaidAddons.includes(row.code) ? " · đã mở" : ""}
                </span>
              </span>
            </label>
          ))}

          <div className="rounded-2xl bg-[#0F4C5C] p-4 text-white">
            <p className="text-sm text-amber-200">
              Tổng {months === 12 ? "12 tháng" : months === 3 ? "3 tháng" : "1 tháng"}
            </p>
            <p className="text-3xl font-black">{formatVnd(total)}</p>
            <p className="text-sm text-white/80">
              {months === 1
                ? "Chuyển đủ số này. Nếu cao hơn gói đang chọn thì hệ thống tự lên gói lớn hơn."
                : "Gói quý/năm không tự đổi lên gói cao hơn — chỉ gia hạn thời gian đang chọn."}
            </p>
          </div>
          <Button
            className={touchBtnClass}
            disabled={pending || !planId || total <= 0}
            onClick={() =>
              start(async () => {
                const result = await createBillingPaymentAction(planId, addonCodes, months);
                if (!result.ok) {
                  toast.error(result.message);
                  return;
                }
                router.push(`/goi-dich-vu?pay=${result.data.paymentId}`);
                router.refresh();
              })
            }
          >
            Lấy mã QR
          </Button>
          {plans
            .filter((plan) => plan.code === "DOANH_NGHIEP")
            .map((plan) => (
              <p key={plan.id} className="text-sm text-neutral-600">
                {plan.name}: liên hệ quản trị, không thanh toán QR.
              </p>
            ))}
        </div>
      )}

      <div>
        <p className="mb-2 text-lg font-bold">Lịch sử thanh toán</p>
        <ul className="space-y-2">
          {payments.map((row) => (
            <li key={row.id} className="rounded-xl bg-white p-4">
              <p className="font-bold">
                {formatVnd(row.amount)} · {row.planName}
              </p>
              <p className="text-sm">
                {row.status === "PENDING"
                  ? "Chờ tiền vào"
                  : row.status === "APPROVED"
                    ? "Đã nhận / đã đổi gói"
                    : "Từ chối / huỷ"}
              </p>
              <p className="text-sm text-neutral-600">{formatVnDate(row.createdAt)}</p>
              {row.status === "PENDING" ? (
                <Link
                  href={`/goi-dich-vu?pay=${row.id}`}
                  className="mt-1 inline-block text-sm font-semibold text-[#0F4C5C]"
                >
                  Xem mã QR
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
