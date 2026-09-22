import ExcelJS from "exceljs";
import { formatVnDate } from "@/lib/datetime";
import { INVOICE_SOURCE_LABEL } from "@/services/report.service";

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F4C5C" },
  };
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
}

export async function workbookToBuffer(wb: ExcelJS.Workbook) {
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function buildCashExcel(
  rows: {
    occurredAt: Date;
    type: string;
    amount: { toString(): string } | number;
    method: string;
    note: string | null;
    expenseCategory: { name: string } | null;
    collectedBy: { name: string };
  }[],
) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Thu chi");
  sheet.columns = [
    { header: "Ngày", key: "ngay", width: 18 },
    { header: "Loại", key: "loai", width: 10 },
    { header: "Số tiền", key: "tien", width: 14 },
    { header: "Cách", key: "cach", width: 14 },
    { header: "Khoản", key: "khoan", width: 18 },
    { header: "Người ghi", key: "nguoi", width: 18 },
    { header: "Ghi chú", key: "ghichu", width: 28 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of rows) {
    sheet.addRow({
      ngay: formatVnDate(row.occurredAt),
      loai: row.type === "THU" ? "Thu" : "Chi",
      tien: Number(row.amount),
      cach: row.method === "TIEN_MAT" ? "Tiền mặt" : "Chuyển khoản",
      khoan: row.expenseCategory?.name ?? (row.type === "THU" ? "Thu" : "Chi"),
      nguoi: row.collectedBy.name,
      ghichu: row.note ?? "",
    });
  }
  return workbookToBuffer(wb);
}

export async function buildVehicleExcel(
  rows: {
    plateNumber: string;
    vehicleType: string;
    ownerName: string;
    phone: string;
    monthlyPrice: number;
    nextDueDate: Date | null;
    status: string;
  }[],
) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Xe tháng");
  sheet.columns = [
    { header: "Biển số", key: "bien", width: 16 },
    { header: "Loại xe", key: "loai", width: 14 },
    { header: "Chủ xe", key: "chu", width: 20 },
    { header: "SĐT", key: "sdt", width: 14 },
    { header: "Giá tháng", key: "gia", width: 14 },
    { header: "Hạn đóng", key: "han", width: 14 },
    { header: "Trạng thái", key: "tt", width: 14 },
  ];
  styleHeader(sheet.getRow(1));
  const typeLabel: Record<string, string> = {
    XE_MAY: "Xe máy",
    XE_MAY_DIEN: "Xe máy điện",
    O_TO: "Ô tô",
    XE_DAP_DIEN: "Xe đạp điện",
  };
  const statusLabel: Record<string, string> = {
    DANG_GUI: "Đang gửi",
    TAM_NGUNG: "Tạm ngưng",
    DA_NGHI: "Đã nghỉ",
  };
  for (const row of rows) {
    sheet.addRow({
      bien: row.plateNumber,
      loai: typeLabel[row.vehicleType] ?? row.vehicleType,
      chu: row.ownerName,
      sdt: row.phone,
      gia: row.monthlyPrice,
      han: row.nextDueDate ? formatVnDate(row.nextDueDate) : "",
      tt: statusLabel[row.status] ?? row.status,
    });
  }
  return workbookToBuffer(wb);
}

export async function buildDebtExcel(
  rows: { label: string; sourceLabel: string; customerName: string; phone: string; amount: number; nextDueDate: Date }[],
) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Công nợ");
  sheet.columns = [
    { header: "Mục", key: "muc", width: 16 },
    { header: "Loại", key: "loai", width: 14 },
    { header: "Khách", key: "khach", width: 20 },
    { header: "SĐT", key: "sdt", width: 14 },
    { header: "Số tiền", key: "tien", width: 14 },
    { header: "Hạn", key: "han", width: 14 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of rows) {
    sheet.addRow({
      muc: row.label,
      loai: row.sourceLabel,
      khach: row.customerName,
      sdt: row.phone,
      tien: row.amount,
      han: formatVnDate(row.nextDueDate),
    });
  }
  return workbookToBuffer(wb);
}

export async function buildInvoiceExcel(
  rows: {
    createdAt: Date;
    customer: { name: string; phone: string };
    source: string;
    totalAmount: { toString(): string } | number;
    status: string;
  }[],
) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Hoá đơn");
  sheet.columns = [
    { header: "Ngày", key: "ngay", width: 14 },
    { header: "Khách", key: "khach", width: 20 },
    { header: "SĐT", key: "sdt", width: 14 },
    { header: "Nguồn", key: "nguon", width: 14 },
    { header: "Số tiền", key: "tien", width: 14 },
    { header: "Trạng thái", key: "tt", width: 16 },
  ];
  styleHeader(sheet.getRow(1));
  const st: Record<string, string> = {
    DA_THANH_TOAN: "Đã thu",
    CHUA_THANH_TOAN: "Chưa thu",
    HUY: "Huỷ",
  };
  for (const row of rows) {
    sheet.addRow({
      ngay: formatVnDate(row.createdAt),
      khach: row.customer.name,
      sdt: row.customer.phone,
      nguon: INVOICE_SOURCE_LABEL[row.source] ?? row.source,
      tien: Number(row.totalAmount),
      tt: st[row.status] ?? row.status,
    });
  }
  return workbookToBuffer(wb);
}
