import { z } from "zod";

export const vehicleTypeSchema = z.enum([
  "XE_MAY",
  "XE_MAY_DIEN",
  "O_TO",
  "XE_DAP_DIEN",
]);

export const billingCycleSchema = z.enum(["THANG", "QUY"]);

export const contractStatusSchema = z.enum(["DANG_GUI", "TAM_NGUNG", "DA_NGHI"]);

export const vehicleFormSchema = z.object({
  plateNumber: z.string().min(3, "Nhập biển số"),
  vehicleType: vehicleTypeSchema,
  ownerName: z.string().min(2, "Nhập tên chủ xe"),
  phone: z.string().min(9, "Nhập số điện thoại"),
  roomOrAddress: z.string().optional(),
  note: z.string().optional(),
  monthlyPrice: z.number().int().positive("Giá phải lớn hơn 0"),
  startDate: z.string().min(8, "Chọn ngày bắt đầu"),
  cycle: billingCycleSchema,
  status: contractStatusSchema.optional(),
  imageUrl: z.string().optional(),
});

export const collectPaymentSchema = z.object({
  vehicleId: z.string().min(1),
  method: z.enum(["TIEN_MAT", "CHUYEN_KHOAN"]),
  note: z.string().optional(),
  months: z.number().int().min(1).max(3).optional(),
  imageUrl: z.string().optional(),
});

export const staffFormSchema = z.object({
  name: z.string().min(2, "Nhập họ tên"),
  email: z.string().email("Email không hợp lệ"),
  phone: z.string().optional(),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
  role: z.enum(["MANAGER", "STAFF", "VIEWER"]),
});

export const onboardingSchema = z.object({
  tenantName: z.string().min(2, "Nhập tên bãi xe"),
  branchName: z.string().min(2, "Nhập tên bãi / địa điểm"),
  xeThang: z.boolean(),
  phongTro: z.boolean(),
  matBang: z.boolean(),
  sacDien: z.boolean(),
  dichVu: z.boolean(),
});

export const cashEntrySchema = z.object({
  amount: z.number().int().positive("Số tiền phải lớn hơn 0"),
  method: z.enum(["TIEN_MAT", "CHUYEN_KHOAN"]),
  note: z.string().optional(),
  imageUrl: z.string().optional(),
  expenseCategoryId: z.string().optional(),
});

export const roomFormSchema = z.object({
  code: z.string().min(1, "Nhập mã phòng"),
  areaM2: z.number().optional(),
  monthlyPrice: z.number().int().positive("Giá phải lớn hơn 0"),
  deposit: z.number().int().min(0),
  note: z.string().optional(),
});

export const rentFormSchema = z.object({
  ownerName: z.string().min(2, "Nhập tên khách"),
  phone: z.string().min(9, "Nhập số điện thoại"),
  monthlyPrice: z.number().int().positive("Giá phải lớn hơn 0"),
  deposit: z.number().int().min(0),
  startDate: z.string().min(8),
  cycle: billingCycleSchema,
  businessType: z.string().optional(),
});

export const kioskFormSchema = z.object({
  code: z.string().min(1, "Nhập mã ô"),
  location: z.string().optional(),
  areaM2: z.number().optional(),
  monthlyPrice: z.number().int().positive("Giá phải lớn hơn 0"),
});

export const utilitySchema = z.object({
  roomId: z.string().min(1),
  periodYm: z.string().min(7),
  oldElectric: z.number().min(0),
  newElectric: z.number().min(0),
  oldWater: z.number().min(0),
  newWater: z.number().min(0),
  electricPrice: z.number().int().min(0),
  waterPrice: z.number().int().min(0),
  trashFee: z.number().int().min(0),
  otherFee: z.number().int().min(0),
  method: z.enum(["TIEN_MAT", "CHUYEN_KHOAN"]),
});

export const serviceTypeSchema = z.object({
  name: z.string().min(2, "Nhập tên dịch vụ"),
  unitPrice: z.number().int().positive("Giá phải lớn hơn 0"),
  unit: z.string().min(1, "Nhập đơn vị"),
  cycle: z.enum(["MOT_LAN", "THANG"]),
});

export const serviceSubSchema = z.object({
  serviceTypeId: z.string().min(1),
  ownerName: z.string().min(2, "Nhập tên khách"),
  phone: z.string().min(9, "Nhập số điện thoại"),
  price: z.number().int().positive("Giá phải lớn hơn 0"),
  startDate: z.string().min(8),
});

export const chargerSchema = z.object({
  code: z.string().min(1, "Nhập mã trụ"),
  location: z.string().optional(),
});

export const chargingPlanSchema = z.object({
  name: z.string().min(2, "Nhập tên gói"),
  billingType: z.enum(["KWH", "GIO", "GOI_THANG"]),
  unitPrice: z.number().int().min(0),
  monthlyPrice: z.number().int().min(0).optional(),
});

export const startChargeSchema = z.object({
  chargerId: z.string().min(1),
  chargingPlanId: z.string().optional(),
  ownerName: z.string().optional(),
  phone: z.string().optional(),
});

export const stopChargeSchema = z.object({
  chargerId: z.string().min(1),
  kwh: z.number().optional(),
  method: z.enum(["TIEN_MAT", "CHUYEN_KHOAN"]),
});

export const collectTargetSchema = z.object({
  method: z.enum(["TIEN_MAT", "CHUYEN_KHOAN"]),
  note: z.string().optional(),
  roomId: z.string().optional(),
  kioskId: z.string().optional(),
  subscriptionId: z.string().optional(),
  months: z.number().int().min(1).max(3).optional(),
  imageUrl: z.string().optional(),
});

export const bulkRemindSchema = z.object({
  template: z.string().min(10, "Nhập nội dung tin"),
  items: z
    .array(
      z.object({
        customerName: z.string(),
        phone: z.string(),
        label: z.string(),
        amount: z.number(),
        nextDueDate: z.string(),
      }),
    )
    .min(1, "Chọn ít nhất một khách")
    .max(80, "Chọn tối đa 80 khách một lần"),
});

export const customerSmsSchema = z.object({
  phone: z.string().min(9, "Nhập số điện thoại"),
  body: z.string().min(5, "Nhập nội dung tin nhắn").max(500, "Tin nhắn tối đa 500 chữ"),
});
