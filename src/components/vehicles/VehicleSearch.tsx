"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { searchVehiclesAction } from "@/actions/vehicles";
import { DueBadge } from "@/components/vehicles/DueBadge";
import { VEHICLE_TYPE_LABEL } from "@/lib/plate";
import { touchInputClass } from "@/lib/utils";

type Row = {
  id: string;
  plateNumber: string;
  vehicleType: keyof typeof VEHICLE_TYPE_LABEL;
  ownerName: string;
  phone: string;
  monthlyPrice: number;
  nextDueDate: Date | string | null;
  status: string;
};

export function VehicleSearch({
  initial,
  hrefSuffix = "",
}: {
  initial: Row[];
  hrefSuffix?: string;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(initial);
  const [pending, start] = useTransition();

  useEffect(() => {
    const handle = setTimeout(() => {
      start(async () => {
        const result = await searchVehiclesAction(q);
        if (result.ok) {
          setRows(result.data);
        }
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <div className="space-y-4">
      <input
        className={touchInputClass}
        placeholder="Gõ 3 số cuối biển số..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {pending ? <p className="text-sm text-neutral-500">Đang tìm...</p> : null}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/xe-thang/${row.id}${hrefSuffix}`}
              className="block rounded-2xl bg-white p-4 ring-1 ring-[#0F4C5C]/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-black tracking-wide">{row.plateNumber}</p>
                  <p className="text-base font-medium">{row.ownerName}</p>
                  <p className="text-sm text-neutral-600">
                    {VEHICLE_TYPE_LABEL[row.vehicleType]} · {row.phone}
                  </p>
                </div>
              </div>
              {row.nextDueDate ? (
                <div className="mt-3">
                  <DueBadge date={new Date(row.nextDueDate)} amount={row.monthlyPrice} />
                </div>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-base text-neutral-600">
          Chưa có xe nào khớp.
        </p>
      ) : null}
    </div>
  );
}
