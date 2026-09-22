"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createChargerAction,
  createChargingPlanAction,
  createServiceTypeAction,
  markChargerBrokenAction,
  startChargeAction,
  stopChargeAction,
  subscribeServiceAction,
} from "@/actions/extras";
import { MoneyInput } from "@/components/money/MoneyInput";
import { Button } from "@/components/ui/button";
import { touchBtnClass, touchInputClass } from "@/lib/utils";

export function ServiceDesk({
  types,
}: {
  types: { id: string; name: string; unitPrice: number; unit: string; cycle: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [unitPrice, setUnitPrice] = useState(50000);
  const [unit, setUnit] = useState("lần");
  const [cycle, setCycle] = useState<"MOT_LAN" | "THANG">("MOT_LAN");
  const [serviceTypeId, setServiceTypeId] = useState(types[0]?.id ?? "");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [price, setPrice] = useState(types[0]?.unitPrice ?? 50000);

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-2xl bg-white p-4">
        <p className="text-lg font-bold">Thêm loại dịch vụ</p>
        <input className={touchInputClass} placeholder="Rửa xe, giữ đồ..." value={name} onChange={(e) => setName(e.target.value)} />
        <MoneyInput name="svcPrice" value={unitPrice} onValueChange={setUnitPrice} />
        <input className={touchInputClass} value={unit} onChange={(e) => setUnit(e.target.value)} />
        <select className={touchInputClass} value={cycle} onChange={(e) => setCycle(e.target.value as typeof cycle)}>
          <option value="MOT_LAN">Thu một lần</option>
          <option value="THANG">Thu theo tháng</option>
        </select>
        <Button
          className={touchBtnClass}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await createServiceTypeAction({ name, unitPrice, unit, cycle });
              if (!result.ok) toast.error(result.message);
              else {
                toast.success("Đã thêm loại dịch vụ.");
                router.refresh();
              }
            })
          }
        >
          Thêm loại
        </Button>
      </div>
      {types.length > 0 ? (
        <div className="space-y-3 rounded-2xl bg-white p-4">
          <p className="text-lg font-bold">Đăng ký cho khách</p>
          <select
            className={touchInputClass}
            value={serviceTypeId}
            onChange={(e) => {
              setServiceTypeId(e.target.value);
              const found = types.find((t) => t.id === e.target.value);
              if (found) setPrice(found.unitPrice);
            }}
          >
            {types.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.cycle === "THANG" ? "Tháng" : "Một lần"}
              </option>
            ))}
          </select>
          <input className={touchInputClass} placeholder="Tên khách" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          <input className={touchInputClass} placeholder="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <MoneyInput name="subPrice" value={price} onValueChange={setPrice} />
          <Button
            className={touchBtnClass}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await subscribeServiceAction({
                  serviceTypeId,
                  ownerName,
                  phone,
                  price,
                  startDate: new Date().toISOString().slice(0, 10),
                });
                if (!result.ok) toast.error(result.message);
                else {
                  toast.success("Đã đăng ký dịch vụ.");
                  router.refresh();
                }
              })
            }
          >
            Đăng ký
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function ChargingDesk({
  chargers,
  plans,
}: {
  chargers: { id: string; code: string; status: string; location: string | null }[];
  plans: { id: string; name: string; billingType: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");
  const [planName, setPlanName] = useState("");
  const [billingType, setBillingType] = useState<"KWH" | "GIO" | "GOI_THANG">("KWH");
  const [unitPrice, setUnitPrice] = useState(4000);
  const [chargerId, setChargerId] = useState(chargers.find((c) => c.status === "RANH")?.id ?? chargers[0]?.id ?? "");
  const [chargingPlanId, setChargingPlanId] = useState(plans[0]?.id ?? "");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [kwh, setKwh] = useState(0);
  const [method, setMethod] = useState<"TIEN_MAT" | "CHUYEN_KHOAN">("TIEN_MAT");
  const stopId = chargers.find((c) => c.status === "DANG_SAC")?.id ?? "";

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-2xl bg-white p-4">
        <p className="text-lg font-bold">Thêm trụ sạc</p>
        <input className={touchInputClass} placeholder="Trụ A1" value={code} onChange={(e) => setCode(e.target.value)} />
        <Button
          className={touchBtnClass}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await createChargerAction({ code });
              if (!result.ok) toast.error(result.message);
              else {
                toast.success("Đã thêm trụ.");
                router.refresh();
              }
            })
          }
        >
          Thêm trụ
        </Button>
      </div>
      <div className="space-y-3 rounded-2xl bg-white p-4">
        <p className="text-lg font-bold">Gói sạc</p>
        <input className={touchInputClass} placeholder="Tên gói" value={planName} onChange={(e) => setPlanName(e.target.value)} />
        <select className={touchInputClass} value={billingType} onChange={(e) => setBillingType(e.target.value as typeof billingType)}>
          <option value="KWH">Theo kWh</option>
          <option value="GIO">Theo giờ</option>
          <option value="GOI_THANG">Gói tháng</option>
        </select>
        <MoneyInput name="unitPrice" value={unitPrice} onValueChange={setUnitPrice} />
        <Button
          className={touchBtnClass}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await createChargingPlanAction({ name: planName, billingType, unitPrice });
              if (!result.ok) toast.error(result.message);
              else {
                toast.success("Đã thêm gói.");
                router.refresh();
              }
            })
          }
        >
          Thêm gói
        </Button>
      </div>
      {chargers.length > 0 ? (
        <div className="space-y-3 rounded-2xl bg-white p-4">
          <p className="text-lg font-bold">Bắt đầu sạc</p>
          <select className={touchInputClass} value={chargerId} onChange={(e) => setChargerId(e.target.value)}>
            {chargers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.status === "RANH" ? "Rảnh" : item.status === "DANG_SAC" ? "Đang sạc" : "Hỏng"}
              </option>
            ))}
          </select>
          {plans.length > 0 ? (
            <select className={touchInputClass} value={chargingPlanId} onChange={(e) => setChargingPlanId(e.target.value)}>
              {plans.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          ) : null}
          <input className={touchInputClass} placeholder="Tên khách (nếu thu tiền)" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          <input className={touchInputClass} placeholder="SĐT" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button
            className={touchBtnClass}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await startChargeAction({
                  chargerId,
                  chargingPlanId: chargingPlanId || undefined,
                  ownerName,
                  phone,
                });
                if (!result.ok) toast.error(result.message);
                else {
                  toast.success("Đã bắt đầu sạc.");
                  router.refresh();
                }
              })
            }
          >
            Bắt đầu sạc
          </Button>
        </div>
      ) : null}
      {stopId ? (
        <div className="space-y-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-300">
          <p className="text-lg font-bold">Kết thúc sạc</p>
          <input
            className={touchInputClass}
            inputMode="decimal"
            placeholder="Số kWh (nếu gói theo kWh)"
            value={kwh || ""}
            onChange={(e) => setKwh(Number(e.target.value) || 0)}
          />
          <select className={touchInputClass} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
            <option value="TIEN_MAT">Tiền mặt</option>
            <option value="CHUYEN_KHOAN">Chuyển khoản</option>
          </select>
          <Button
            className={touchBtnClass}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await stopChargeAction({ chargerId: stopId, kwh: kwh || undefined, method });
                if (!result.ok) toast.error(result.message);
                else {
                  toast.success(
                    result.data.amountLabel === "0 đ"
                      ? "Đã kết thúc. Gói tháng không thu thêm."
                      : `Đã thu ${result.data.amountLabel}.`,
                  );
                  if (result.data.safetyWarning) toast.message("Sạc hơn 8 giờ. Kiểm tra an toàn giúp.");
                  router.refresh();
                }
              })
            }
          >
            Kết thúc và thu
          </Button>
        </div>
      ) : null}
      <ul className="space-y-2">
        {chargers.map((item) => (
          <li key={item.id} className="flex items-center justify-between rounded-xl bg-white p-3">
            <span className="font-bold">{item.code}</span>
            {item.status !== "DANG_SAC" ? (
              <button
                type="button"
                className="text-sm font-semibold text-[#0F4C5C]"
                onClick={() =>
                  start(async () => {
                    const result = await markChargerBrokenAction(item.id, item.status !== "HONG");
                    if (!result.ok) toast.error(result.message);
                    else router.refresh();
                  })
                }
              >
                {item.status === "HONG" ? "Để rảnh" : "Báo hỏng"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
