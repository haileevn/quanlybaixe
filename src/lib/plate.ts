export function normalizePlate(plate: string) {
  return plate.trim().toUpperCase().replace(/\s+/g, "");
}

/** Chỉ giữ chữ số để tìm theo 3 số cuối. */
export function plateSearchKey(plate: string) {
  return normalizePlate(plate).replace(/\D/g, "");
}

export const VEHICLE_TYPE_LABEL = {
  XE_MAY: "Xe máy",
  XE_MAY_DIEN: "Xe máy điện",
  O_TO: "Ô tô",
  XE_DAP_DIEN: "Xe đạp điện",
} as const;

export const CONTRACT_STATUS_LABEL = {
  DANG_GUI: "Đang gửi",
  TAM_NGUNG: "Tạm ngưng",
  DA_NGHI: "Đã nghỉ",
} as const;

export const CYCLE_LABEL = {
  THANG: "Theo tháng",
  QUY: "Theo quý",
} as const;

export const ROLE_LABEL = {
  SUPER_ADMIN: "Quản trị hệ thống",
  OWNER: "Chủ bãi",
  MANAGER: "Quản lý",
  STAFF: "Nhân viên",
  VIEWER: "Người xem",
} as const;
