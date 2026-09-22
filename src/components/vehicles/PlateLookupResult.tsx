"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Plus,
  Phone,
  User,
  MapPin,
  FileText,
  ShieldAlert,
  Camera,
} from "lucide-react";
import type { VehicleLookupResult } from "@/actions/vehicles";
import { formatVnd } from "@/lib/money";
import { VEHICLE_TYPE_LABEL } from "@/lib/plate";
import { CollectButton } from "@/components/vehicles/CollectButton";

export function PlateLookupResult({
  result,
  capturedImageUrl,
  onReset,
}: {
  result: VehicleLookupResult;
  capturedImageUrl?: string | null;
  onReset: () => void;
}) {
  // TRƯỜNG HỢP 1: XE ĐÃ ĐĂNG KÝ TRONG BÃI
  if (result.found) {
    const { vehicle } = result;
    const contract = vehicle.contract;

    const isOverdue = contract?.dueStatus === "OVERDUE";
    const isDueSoon = contract?.dueStatus === "DUE_SOON";

    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
        {/* Banner kết quả tìm thấy */}
        <div className="flex items-center justify-between rounded-2xl bg-emerald-500/10 p-4 border border-emerald-500/20 text-emerald-900">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-6 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
                Đã đăng ký trong bãi
              </p>
              <p className="text-2xl font-black tracking-wide text-[#0F4C5C]">
                {vehicle.plateNumber}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
            {VEHICLE_TYPE_LABEL[vehicle.vehicleType as keyof typeof VEHICLE_TYPE_LABEL] ?? vehicle.vehicleType}
          </span>
        </div>

        {/* Khối hình ảnh đối chiếu nhận diện xe */}
        {(vehicle.imageUrl || capturedImageUrl) && (
          <div className="rounded-2xl bg-white p-4 ring-1 ring-[#0F4C5C]/10 shadow-sm space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
              <Camera className="size-4 text-[#0F4C5C]" />
              Hình ảnh nhận diện xe
            </p>
            <div className="grid grid-cols-2 gap-3">
              {vehicle.imageUrl ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-neutral-600">Ảnh hồ sơ lưu:</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={vehicle.imageUrl}
                    alt="Ảnh xe hồ sơ"
                    className="h-32 w-full rounded-xl object-cover ring-1 ring-neutral-200"
                  />
                </div>
              ) : null}
              {capturedImageUrl ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-neutral-600">Ảnh vừa quét:</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={capturedImageUrl}
                    alt="Ảnh vừa quét"
                    className="h-32 w-full rounded-xl object-cover ring-1 ring-neutral-200"
                  />
                </div>
              ) : null}
            </div>
            {vehicle.note ? (
              <p className="text-xs text-neutral-600 bg-neutral-50 p-2.5 rounded-lg">
                <span className="font-semibold text-neutral-800">Đặc điểm / Ghi chú:</span> {vehicle.note}
              </p>
            ) : null}
          </div>
        )}

        {/* Thông tin chủ xe */}
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#0F4C5C]/10 shadow-sm space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Thông tin chủ xe
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-neutral-700">
              <User className="size-4 text-[#0F4C5C] shrink-0" />
              <span className="font-semibold text-neutral-900">{vehicle.ownerName}</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-700">
              <Phone className="size-4 text-[#0F4C5C] shrink-0" />
              <a href={`tel:${vehicle.phone}`} className="font-semibold text-[#0F4C5C] hover:underline">
                {vehicle.phone}
              </a>
            </div>
            {vehicle.roomOrAddress ? (
              <div className="col-span-2 flex items-center gap-2 text-neutral-700">
                <MapPin className="size-4 text-[#0F4C5C] shrink-0" />
                <span>Phòng / Địa chỉ: <strong>{vehicle.roomOrAddress}</strong></span>
              </div>
            ) : null}
          </div>
        </div>

        {/* KHỐI SỐ THÁNG CHI TIẾT */}
        {contract ? (
          <div className="rounded-2xl bg-white p-4 ring-1 ring-[#0F4C5C]/10 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                <Clock className="size-4 text-[#0F4C5C]" />
                Số tháng gửi chi tiết
              </p>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  isOverdue
                    ? "bg-red-100 text-red-700"
                    : isDueSoon
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {isOverdue
                  ? `Quá hạn ${Math.abs(contract.daysRemaining)} ngày`
                  : isDueSoon
                  ? `Sắp tới hạn (${contract.daysRemaining} ngày)`
                  : "Còn hạn gửi"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-[#FBF6EE] p-3">
                <p className="text-xs text-neutral-500">Đã gửi trong bãi</p>
                <p className="text-xl font-black text-[#0F4C5C]">{contract.monthsSent} tháng</p>
                <p className="text-xs text-neutral-500 mt-0.5">Từ ngày {contract.startDateFormatted}</p>
              </div>

              <div className="rounded-xl bg-[#FBF6EE] p-3">
                <p className="text-xs text-neutral-500">Hạn đóng tiếp theo</p>
                <p className="text-xl font-black text-[#0F4C5C]">{contract.nextDueDateFormatted}</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Chu kỳ {contract.cycle === "QUY" ? "3 tháng/lần" : "1 tháng/lần"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-3.5 py-2.5 text-sm">
              <span className="text-neutral-600">Đơn giá tháng:</span>
              <span className="text-base font-black text-[#0F4C5C]">
                {formatVnd(contract.monthlyPrice)} / tháng
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 border border-amber-200">
            Chưa có hợp đồng gửi xe đang kích hoạt.
          </div>
        )}

        {/* KHỐI CHI TIẾT ĐÓNG TIỀN & LỊCH SỬ */}
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#0F4C5C]/10 shadow-sm space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
            <CreditCard className="size-4 text-[#0F4C5C]" />
            Lịch sử & Chi tiết đóng tiền ({vehicle.payments.length} lần)
          </p>

          {vehicle.payments.length === 0 ? (
            <p className="rounded-xl bg-neutral-50 p-3 text-center text-sm text-neutral-500">
              Chưa có lần thu tiền nào được ghi nhận.
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {vehicle.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/70 p-3 text-sm"
                >
                  <div>
                    <p className="font-bold text-neutral-900">{formatVnd(p.amount)}</p>
                    <p className="text-xs text-neutral-500 flex items-center gap-1">
                      <Calendar className="size-3.5" /> Ngày thu: {p.paidAtFormatted}
                    </p>
                  </div>
                  <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 border border-neutral-200 shadow-xs">
                    {p.method === "CHUYEN_KHOAN" ? "Chuyển khoản" : "Tiền mặt"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Các nút hành động nhanh */}
        <div className="space-y-2.5 pt-2">
          {contract && (
            <CollectButton
              vehicleId={vehicle.id}
              plateNumber={vehicle.plateNumber}
              amount={contract.monthlyPrice}
            />
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <Link
              href={`/xe-thang/${vehicle.id}`}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#0F4C5C] py-3.5 text-center text-sm font-bold text-white shadow-sm hover:bg-[#0c3c49]"
            >
              <FileText className="size-4" />
              Xem hồ sơ xe
            </Link>

            <button
              type="button"
              onClick={onReset}
              className="rounded-2xl border border-neutral-300 bg-white py-3.5 text-center text-sm font-bold text-neutral-700 shadow-sm hover:bg-neutral-50"
            >
              Quét xe khác
            </button>
          </div>
        </div>
      </div>
    );
  }

  // TRƯỜNG HỢP 2: XE CHƯA ĐĂNG KÝ TRONG BÃI
  const targetPlate = result.plateNumber.trim().toUpperCase();
  const createUrl = `/xe-thang/them?plate=${encodeURIComponent(targetPlate)}${
    capturedImageUrl ? `&imageUrl=${encodeURIComponent(capturedImageUrl)}` : ""
  }`;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Banner cảnh báo chưa đăng ký */}
      <div className="rounded-3xl border-2 border-red-200 bg-red-50 p-5 text-center text-red-950 shadow-sm space-y-3">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-red-100 ring-8 ring-red-50">
          <ShieldAlert className="size-8 text-red-600" />
        </div>

        <div>
          <span className="inline-block rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white tracking-wide uppercase">
            Cảnh báo bãi xe
          </span>
          <h2 className="mt-2 text-2xl font-black text-red-900 tracking-tight">
            Xe không đăng ký trong bãi!
          </h2>
          <p className="mt-1 text-sm text-red-800">
            Biển số{" "}
            <span className="font-black text-lg bg-red-200/80 px-2 py-0.5 rounded-md text-red-950">
              {targetPlate || "Không xác định"}
            </span>{" "}
            chưa có trong dữ liệu quản lý.
          </p>
        </div>

        <div className="rounded-2xl bg-white/90 p-4 text-left border border-red-200 space-y-2 text-sm text-neutral-700">
          <p className="font-semibold text-neutral-900 flex items-center gap-1.5">
            <AlertTriangle className="size-4 text-amber-600" />
            Bạn có muốn thêm xe mới này vào bãi không?
          </p>
          <p className="text-xs text-neutral-600 leading-relaxed">
            Hệ thống sẽ chuyển biển số vừa quét sang biểu mẫu tạo mới. Bạn có thể chụp thêm ảnh xe
            (màu sắc, đặc điểm nhận dạng) để tiện kiểm soát ra vào.
          </p>
        </div>

        {capturedImageUrl && (
          <div className="rounded-2xl bg-white p-3 border border-red-100 text-left">
            <p className="text-xs font-semibold text-neutral-600 mb-2 flex items-center gap-1">
              <Camera className="size-3.5" /> Ảnh biển số vừa quét:
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capturedImageUrl}
              alt="Ảnh vừa quét"
              className="h-32 w-full rounded-xl object-cover"
            />
          </div>
        )}

        {/* Nút hành động */}
        <div className="space-y-2 pt-2">
          <Link
            href={createUrl}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-center text-base font-bold text-white shadow-md hover:bg-emerald-700 active:scale-[0.98] transition"
          >
            <Plus className="size-5" />
            Thêm xe vào bãi ngay
          </Link>

          <button
            type="button"
            onClick={onReset}
            className="w-full rounded-2xl border border-neutral-300 bg-white py-3 text-center text-sm font-semibold text-neutral-700 shadow-sm hover:bg-neutral-50"
          >
            Quét lại biển số khác
          </button>
        </div>
      </div>
    </div>
  );
}
