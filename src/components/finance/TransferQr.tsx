"use client";

import { useEffect, useState } from "react";
import { collectQrAction } from "@/actions/billing";
import { formatVnd } from "@/lib/money";
import Link from "next/link";

export function TransferQr({
  amount,
  addInfo,
}: {
  amount: number;
  addInfo: string;
}) {
  const [qr, setQr] = useState<{
    qrDataUrl: string;
    bankName: string;
    accountNo: string;
    accountName: string;
    addInfo: string;
    amount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void collectQrAction({ amount, addInfo }).then((result) => {
      if (!alive) return;
      if (!result.ok) {
        setError(result.message);
        setQr(null);
        return;
      }
      setError(null);
      setQr(result.data);
    });
    return () => {
      alive = false;
    };
  }, [amount, addInfo]);

  if (error) {
    return (
      <p className="rounded-xl bg-amber-50 p-3 text-sm">
        {error}{" "}
        <Link href="/cai-dat" className="font-semibold text-[#0F4C5C]">
          Điền số tài khoản
        </Link>
      </p>
    );
  }
  if (!qr) {
    return <p className="text-sm text-neutral-600">Đang tạo mã QR...</p>;
  }

  return (
    <div className="space-y-2 rounded-xl bg-neutral-50 p-3 text-center">
      <p className="font-bold">Khách quét QR chuyển {formatVnd(qr.amount)}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr.qrDataUrl} alt="Mã QR thu tiền" className="mx-auto w-44" />
      <p className="text-sm">{qr.bankName}</p>
      <p className="font-bold">{qr.accountNo}</p>
      <p className="text-sm">{qr.accountName}</p>
      <p className="rounded-lg bg-amber-50 p-2 text-sm font-semibold">Nội dung: {qr.addInfo}</p>
    </div>
  );
}
