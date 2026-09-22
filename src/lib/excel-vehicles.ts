import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import type { VehicleInput } from "@/services/vehicle.service";

const TYPE_MAP: Record<string, VehicleInput["vehicleType"]> = {
  xe_may: "XE_MAY",
  "xe máy": "XE_MAY",
  xe_may_dien: "XE_MAY_DIEN",
  "xe máy điện": "XE_MAY_DIEN",
  o_to: "O_TO",
  "ô tô": "O_TO",
  oto: "O_TO",
  xe_dap_dien: "XE_DAP_DIEN",
  "xe đạp điện": "XE_DAP_DIEN",
};

function cell(row: ExcelJS.Row, index: number) {
  const value = row.getCell(index).value;
  if (value == null) return "";
  if (typeof value === "object" && "text" in value) {
    return String((value as { text: string }).text);
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

export async function parseVehicleWorkbook(buffer: Buffer, filename: string) {
  const wb = new ExcelJS.Workbook();
  if (filename.toLowerCase().endsWith(".csv")) {
    await wb.csv.read(Readable.from(buffer));
  } else {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  }
  const sheet = wb.worksheets[0];
  if (!sheet) {
    return [] as VehicleInput[];
  }
  const rows: VehicleInput[] = [];
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const plateNumber = cell(row, 1);
    if (!plateNumber) return;
    const typeRaw = cell(row, 2).toLowerCase();
    rows.push({
      plateNumber,
      vehicleType: TYPE_MAP[typeRaw] ?? "XE_MAY",
      ownerName: cell(row, 3) || "Chưa đặt tên",
      phone: cell(row, 4) || "0000000000",
      roomOrAddress: cell(row, 5) || undefined,
      monthlyPrice: Number(cell(row, 6).replace(/\D/g, "")) || 150000,
      startDate: cell(row, 7) || new Date().toISOString().slice(0, 10),
      cycle: "THANG",
      note: cell(row, 8) || undefined,
    });
  });
  return rows;
}
