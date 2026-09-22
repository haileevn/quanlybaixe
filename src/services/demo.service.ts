import { prisma } from "@/lib/prisma";
import { createTenantClient } from "@/lib/prisma-tenant";
import { nowVn } from "@/lib/datetime";
import { createVehicle } from "@/services/vehicle.service";
import { collectVehiclePayment } from "@/services/transaction.service";
import { createRoom, rentRoom } from "@/services/room.service";
import { createKiosk, rentKiosk } from "@/services/kiosk.service";
import { createServiceType, subscribeService } from "@/services/extra.service";
import { createCharger, createChargingPlan } from "@/services/charging.service";
import { ALL_MODULES_ON } from "@/lib/modules";

const DEMO_VEHICLES = [
  {
    plateNumber: "59H1-234.56",
    vehicleType: "XE_MAY" as const,
    ownerName: "Nguyễn Văn Hùng",
    phone: "0903123456",
    roomOrAddress: "Phòng 102",
    monthlyPrice: 150000,
    startDateOffset: -35,
    dueOffset: -5,
  },
  {
    plateNumber: "51G1-888.88",
    vehicleType: "XE_MAY" as const,
    ownerName: "Trần Thị Mai",
    phone: "0912345678",
    roomOrAddress: "Phòng 203",
    monthlyPrice: 150000,
    startDateOffset: -28,
    dueOffset: 0,
  },
  {
    plateNumber: "29A-445.67",
    vehicleType: "O_TO" as const,
    ownerName: "Lê Quốc Anh",
    phone: "0987654321",
    roomOrAddress: "Tầng hầm A",
    monthlyPrice: 1200000,
    startDateOffset: -20,
    dueOffset: 3,
  },
  {
    plateNumber: "60B2-112.33",
    vehicleType: "XE_MAY_DIEN" as const,
    ownerName: "Phạm Ngọc Lan",
    phone: "0934567890",
    roomOrAddress: "Phòng 305",
    monthlyPrice: 180000,
    startDateOffset: -15,
    dueOffset: 6,
  },
  {
    plateNumber: "50C1-999.00",
    vehicleType: "XE_MAY" as const,
    ownerName: "Đỗ Minh Tuấn",
    phone: "0978123456",
    roomOrAddress: "Kiot 4",
    monthlyPrice: 120000,
    startDateOffset: -40,
    dueOffset: 20,
  },
  {
    plateNumber: "43D1-321.00",
    vehicleType: "XE_DAP_DIEN" as const,
    ownerName: "Võ Thị Hạnh",
    phone: "0909876543",
    roomOrAddress: "Phòng 110",
    monthlyPrice: 80000,
    startDateOffset: -10,
    dueOffset: 4,
  },
  {
    plateNumber: "72E1-654.32",
    vehicleType: "O_TO" as const,
    ownerName: "Hoàng Văn Đức",
    phone: "0888123123",
    roomOrAddress: "Tầng hầm B",
    monthlyPrice: 1500000,
    startDateOffset: -50,
    dueOffset: -12,
  },
  {
    plateNumber: "30F1-111.22",
    vehicleType: "XE_MAY" as const,
    ownerName: "Bùi Thanh Hà",
    phone: "0944556677",
    roomOrAddress: "Phòng 401",
    monthlyPrice: 150000,
    startDateOffset: -8,
    dueOffset: 2,
  },
];

export async function enableDemoData(tenantId: string, userId: string, branchId: string) {
  await disableDemoData(tenantId);
  const db = createTenantClient(tenantId);

  for (const item of DEMO_VEHICLES) {
    const start = nowVn().add(item.startDateOffset, "day").format("YYYY-MM-DD");
    const vehicle = await createVehicle(
      db,
      { tenantId, branchId, userId, isDemo: true },
      {
        plateNumber: item.plateNumber,
        vehicleType: item.vehicleType,
        ownerName: item.ownerName,
        phone: item.phone,
        roomOrAddress: item.roomOrAddress,
        monthlyPrice: item.monthlyPrice,
        startDate: start,
        cycle: "THANG",
      },
    );
    const due = nowVn().add(item.dueOffset, "day").startOf("day").toDate();
    await prisma.vehicleContract.updateMany({
      where: { vehicleId: vehicle.id, tenantId, isDemo: true },
      data: { nextDueDate: due },
    });
  }

  const paid = await prisma.vehicle.findFirst({
    where: { tenantId, plateNumber: "50C1-999.00", isDemo: true, deletedAt: null },
  });
  if (paid) {
    await collectVehiclePayment(
      db,
      { tenantId, branchId, userId },
      { vehicleId: paid.id, method: "TIEN_MAT", note: "Dữ liệu mẫu" },
    );
    await prisma.vehicleContract.updateMany({
      where: { vehicleId: paid.id, tenantId, isDemo: true },
      data: { nextDueDate: nowVn().add(20, "day").startOf("day").toDate() },
    });
  }

  const paused = await prisma.vehicle.findFirst({
    where: { tenantId, plateNumber: "30F1-111.22", isDemo: true, deletedAt: null },
  });
  if (paused) {
    await prisma.vehicleContract.updateMany({
      where: { vehicleId: paused.id, tenantId, isDemo: true },
      data: { status: "TAM_NGUNG" },
    });
  }

  const start = nowVn().format("YYYY-MM-DD");
  const roomA = await createRoom(db, { tenantId, branchId, userId, isDemo: true }, {
    code: "P102",
    areaM2: 18,
    monthlyPrice: 2800000,
    deposit: 2500000,
  });
  await rentRoom(
    db,
    { tenantId, branchId, userId, isDemo: true },
    {
      roomId: roomA.id,
      ownerName: "Nguyễn Văn Hùng",
      phone: "0903123456",
      monthlyPrice: 2800000,
      deposit: 2500000,
      startDate: start,
      cycle: "THANG",
    },
  );
  await prisma.roomContract.updateMany({
    where: { roomId: roomA.id, tenantId, isDemo: true },
    data: { nextDueDate: nowVn().add(-2, "day").startOf("day").toDate() },
  });
  await createRoom(db, { tenantId, branchId, userId, isDemo: true }, {
    code: "P203",
    areaM2: 22,
    monthlyPrice: 3200000,
    deposit: 2500000,
  });

  const kiosk = await createKiosk(db, { tenantId, branchId, userId, isDemo: true }, {
    code: "Kiot 4",
    location: "Cổng trước",
    monthlyPrice: 4500000,
  });
  await rentKiosk(
    db,
    { tenantId, branchId, userId, isDemo: true },
    {
      kioskId: kiosk.id,
      ownerName: "Đỗ Minh Tuấn",
      phone: "0978123456",
      businessType: "Sửa xe",
      monthlyPrice: 4500000,
      deposit: 3000000,
      startDate: start,
      cycle: "THANG",
    },
  );

  const wash = await createServiceType(
    db,
    { tenantId, userId, isDemo: true },
    { name: "Rửa xe", unitPrice: 40000, unit: "lần", cycle: "MOT_LAN" },
  );
  await subscribeService(
    db,
    { tenantId, branchId, userId, isDemo: true },
    {
      serviceTypeId: wash.id,
      ownerName: "Trần Thị Mai",
      phone: "0912345678",
      price: 40000,
      startDate: start,
    },
  );
  const keep = await createServiceType(
    db,
    { tenantId, userId, isDemo: true },
    { name: "Giữ đồ tháng", unitPrice: 200000, unit: "tháng", cycle: "THANG" },
  );
  await subscribeService(
    db,
    { tenantId, branchId, userId, isDemo: true },
    {
      serviceTypeId: keep.id,
      ownerName: "Phạm Ngọc Lan",
      phone: "0934567890",
      price: 200000,
      startDate: start,
    },
  );

  await createCharger(db, { tenantId, branchId, userId, isDemo: true }, { code: "Trụ A1", location: "Cổng sau" });
  await createCharger(db, { tenantId, branchId, userId, isDemo: true }, { code: "Trụ A2", location: "Cổng sau" });
  await createChargingPlan(db, { tenantId, isDemo: true }, {
    name: "Theo kWh",
    billingType: "KWH",
    unitPrice: 4000,
  });
  await createChargingPlan(db, { tenantId, isDemo: true }, {
    name: "Theo giờ",
    billingType: "GIO",
    unitPrice: 15000,
  });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { demoDataEnabled: true, enabledModules: ALL_MODULES_ON },
  });
}

export async function disableDemoData(tenantId: string) {
  await prisma.transaction.deleteMany({ where: { tenantId, isDemo: true } });
  await prisma.invoiceItem.deleteMany({ where: { tenantId, isDemo: true } });
  await prisma.invoice.deleteMany({ where: { tenantId, isDemo: true } });
  await prisma.utilityReading.deleteMany({ where: { tenantId, isDemo: true } });
  await prisma.chargingSession.deleteMany({ where: { tenantId, isDemo: true } });
  await prisma.roomContract.deleteMany({ where: { tenantId, isDemo: true } });
  await prisma.kioskContract.deleteMany({ where: { tenantId, isDemo: true } });
  await prisma.serviceSubscription.deleteMany({ where: { tenantId, isDemo: true } });
  await prisma.room.deleteMany({ where: { tenantId, isDemo: true } });
  await prisma.kiosk.deleteMany({ where: { tenantId, isDemo: true } });
  await prisma.serviceType.deleteMany({ where: { tenantId, isDemo: true } });
  await prisma.charger.deleteMany({ where: { tenantId, isDemo: true } });
  await prisma.chargingPlan.deleteMany({ where: { tenantId, isDemo: true } });
  await prisma.vehicleContract.deleteMany({ where: { tenantId, isDemo: true } });
  await prisma.vehicle.deleteMany({ where: { tenantId, isDemo: true } });
  await prisma.customer.deleteMany({ where: { tenantId, isDemo: true } });
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { demoDataEnabled: false },
  });
}
