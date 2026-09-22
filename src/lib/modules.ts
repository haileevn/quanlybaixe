export type EnabledModules = {
  xeThang: boolean;
  phongTro: boolean;
  matBang: boolean;
  sacDien: boolean;
  dichVu: boolean;
};

export const DEFAULT_MODULES: EnabledModules = {
  xeThang: true,
  phongTro: false,
  matBang: false,
  sacDien: false,
  dichVu: false,
};

export const MODULE_OPTIONS: {
  key: keyof EnabledModules;
  title: string;
  hint: string;
}[] = [
  { key: "xeThang", title: "Gửi xe tháng", hint: "Xe máy, ô tô gửi theo tháng" },
  { key: "phongTro", title: "Phòng trọ", hint: "Cho thuê phòng trong khuôn viên" },
  { key: "matBang", title: "Mặt bằng", hint: "Ô / ki-ốt kinh doanh nhỏ" },
  { key: "sacDien", title: "Sạc xe điện", hint: "Trụ sạc và gói sạc tháng" },
  { key: "dichVu", title: "Dịch vụ khác", hint: "Rửa xe, kho, giữ đồ..." },
];

export type ReminderConfig = {
  daysBefore: number[];
  daysOverdue: number[];
  smsEnabled: boolean;
};

export const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  daysBefore: [7, 3, 0],
  daysOverdue: [1, 3, 7],
  smsEnabled: true,
};

export function parseReminderConfig(value: unknown): ReminderConfig {
  if (!value || typeof value !== "object") {
    return DEFAULT_REMINDER_CONFIG;
  }
  const raw = value as Record<string, unknown>;
  const daysBefore = Array.isArray(raw.daysBefore)
    ? raw.daysBefore.filter((n): n is number => typeof n === "number")
    : DEFAULT_REMINDER_CONFIG.daysBefore;
  const daysOverdue = Array.isArray(raw.daysOverdue)
    ? raw.daysOverdue.filter((n): n is number => typeof n === "number")
    : DEFAULT_REMINDER_CONFIG.daysOverdue;
  return {
    daysBefore: daysBefore.length ? daysBefore : DEFAULT_REMINDER_CONFIG.daysBefore,
    daysOverdue: daysOverdue.length ? daysOverdue : DEFAULT_REMINDER_CONFIG.daysOverdue,
    smsEnabled: raw.smsEnabled !== false,
  };
}

export function parseEnabledModules(value: unknown): EnabledModules {
  if (!value || typeof value !== "object") {
    return DEFAULT_MODULES;
  }
  const raw = value as Record<string, unknown>;
  return {
    xeThang: raw.xeThang !== false,
    phongTro: raw.phongTro === true,
    matBang: raw.matBang === true,
    sacDien: raw.sacDien === true,
    dichVu: raw.dichVu === true,
  };
}

export const ALL_MODULES_ON: EnabledModules = {
  xeThang: true,
  phongTro: true,
  matBang: true,
  sacDien: true,
  dichVu: true,
};

export const MODULE_HREF: Record<keyof EnabledModules, string> = {
  xeThang: "/xe-thang",
  phongTro: "/phong-tro",
  matBang: "/mat-bang",
  sacDien: "/sac-dien",
  dichVu: "/dich-vu",
};

export const ADDON_MODULE_KEYS = ["phongTro", "matBang", "sacDien", "dichVu"] as const;
export type AddonModuleKey = (typeof ADDON_MODULE_KEYS)[number];

export function parseAddonCodes(value: unknown): AddonModuleKey[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AddonModuleKey =>
    ADDON_MODULE_KEYS.includes(item as AddonModuleKey),
  );
}

export function mergePaidAddons(current: EnabledModules, addons: AddonModuleKey[]): EnabledModules {
  const next = { ...current, xeThang: true };
  for (const key of addons) next[key] = true;
  return next;
}
