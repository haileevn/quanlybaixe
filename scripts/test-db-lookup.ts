import { prisma } from "../src/lib/prisma";
import { findVehicleByPlateDetailed } from "../src/services/vehicle.service";
import { formatVnDate, toVn, daysUntil } from "../src/lib/datetime";
import { toNumber, formatVnd } from "../src/lib/money";

async function run() {
  console.log("=== KIỂM THỬ TRUY VẤN XE & SỐ THÁNG & LỊCH SỬ ĐÓNG TIỀN ===");

  const tenant = await prisma.tenant.findFirst({
    where: { deletedAt: null },
  });

  if (!tenant) {
    console.log("Chưa có tenant.");
    return;
  }

  // Lấy xe mẫu trong database
  const sampleVehicle = await prisma.vehicle.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    include: {
      customer: true,
      contracts: { where: { deletedAt: null } },
    },
  });

  if (!sampleVehicle) {
    console.log("Chưa có xe trong DB để test tra cứu xe có sẵn.");
  } else {
    console.log(`\n1. Tra cứu xe ĐÃ ĐĂNG KÝ: Biển số "${sampleVehicle.plateNumber}"`);
    const found = await findVehicleByPlateDetailed(prisma as any, sampleVehicle.plateNumber);
    if (found) {
      const contract = found.contracts[0];
      const monthsSent = contract
        ? Math.max(1, Math.floor(toVn(new Date()).diff(toVn(contract.startDate), "month", true)) + 1)
        : 0;
      const daysRemaining = contract ? daysUntil(contract.nextDueDate) : 0;

      console.log(` -> Tìm thấy xe: ${found.plateNumber} (${found.vehicleType})`);
      console.log(` -> Chủ xe: ${found.customer.name} - SĐT: ${found.customer.phone}`);
      console.log(` -> Ngày bắt đầu gửi: ${contract ? formatVnDate(contract.startDate) : "N/A"}`);
      console.log(` -> Số tháng đã gửi: ${monthsSent} tháng`);
      console.log(` -> Hạn đóng tiền tiếp theo: ${contract ? formatVnDate(contract.nextDueDate) : "N/A"} (${daysRemaining >= 0 ? `Còn ${daysRemaining} ngày` : `Quá hạn ${Math.abs(daysRemaining)} ngày`})`);
      console.log(` -> Đơn giá: ${contract ? formatVnd(toNumber(contract.monthlyPrice)) : 0}/tháng`);
    }
  }

  // Thử tra cứu xe chưa đăng ký
  const fakePlate = "59Z9-999.99";
  console.log(`\n2. Tra cứu xe CHƯA ĐĂNG KÝ: Biển số "${fakePlate}"`);
  const notFound = await findVehicleByPlateDetailed(prisma as any, fakePlate);
  console.log(` -> Kết quả: ${notFound ? "Tìm thấy" : "KHÔNG CÓ TRONG BÃI (Đúng chuẩn thông báo: Xe không đăng ký trong bãi!)"}`);

  console.log("\n=== HOÀN TẤT KIỂM THỬ ===");
  await prisma.$disconnect();
}

run().catch(console.error);
