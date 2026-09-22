"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createPublicPayAction, lookupDueAction } from "@/actions/collect";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";
import { formatVnDate } from "@/lib/datetime";
import { touchBtnClass, touchInputClass } from "@/lib/utils";

type Row = {
  vehicleId: string;
  tenantName: string;
  plateNumber: string;
  customerName: string;
  amount: number;
  nextDueDate: Date | string;
};

export function LookupDueForm() {
  const router = useRouter();
  const [plateTail, setPlateTail] = useState("");
  const [phone, setPhone] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-[#0F4C5C]">Tra hạn / đóng tiền</h1>
      <p className="text-base text-neutral-600">Nhập 3 số cuối biển xe và số điện thoại đã đăng ký.</p>
      <input
        className={touchInputClass}
        inputMode="numeric"
        placeholder="3 số cuối biển"
        value={plateTail}
        onChange={(e) => setPlateTail(e.target.value)}
      />
      <input
        className={touchInputClass}
        inputMode="tel"
        placeholder="Số điện thoại"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <Button
        className={touchBtnClass}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await lookupDueAction({ plateTail, phone });
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            setRows(result.data.rows);
            if (result.data.rows.length === 0) toast.error("Không tìm thấy xe khớp.");
          })
        }
      >
        Tra cứu
      </Button>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.vehicleId} className="rounded-2xl bg-white p-4">
            <p className="text-xl font-black">{row.plateNumber}</p>
            <p>{row.tenantName}</p>
            <p>
              Hạn {formatVnDate(row.nextDueDate)} · {formatVnd(row.amount)}/tháng
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                className="h-12"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await createPublicPayAction({
                      plateTail,
                      phone,
                      vehicleId: row.vehicleId,
                      months: 1,
                    });
                    if (!result.ok) toast.error(result.message);
                    else router.push(`/thanh-toan/${result.data.token}`);
                  })
                }
              >
                Đóng 1 tháng
              </Button>
              <Button
                className="h-12"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await createPublicPayAction({
                      plateTail,
                      phone,
                      vehicleId: row.vehicleId,
                      months: 3,
                    });
                    if (!result.ok) toast.error(result.message);
                    else router.push(`/thanh-toan/${result.data.token}`);
                  })
                }
              >
                Đóng 3 tháng
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
