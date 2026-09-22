/**
 * 63 mã tỉnh thành phố hợp lệ tại Việt Nam theo Thông tư 24/2023/TT-BCA & 58/2020/TT-BCA
 */
export const VALID_VN_PROVINCES = new Set([
  "11", "12", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24",
  "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37",
  "38", "40", "43", "47", "48", "49", "50", "51", "52", "53", "54", "55", "56",
  "57", "58", "59", "60", "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "70", "71", "72", "73", "74", "75", "76", "77", "78", "79", "81", "82", "83",
  "84", "85", "86", "88", "89", "90", "92", "93", "94", "95", "97", "98", "99",
]);

export interface PlateValidationResult {
  isValid: boolean;
  provinceCode: string;
  series: string;
  numberPart: string;
  vehicleTypeHint: "XE_MAY" | "O_TO" | "UNKNOWN";
  reason?: string;
}

/**
 * Kiểm tra tính hợp lệ của biển số xe Việt Nam
 * Hỗ trợ các định dạng:
 * - 51H-919.91 (Ô tô 5 số)
 * - 59H1-889.12 (Xe máy 5 số)
 * - 29A1-445.67 (Xe máy 5 số)
 * - 51MD1-123.45 (Xe máy điện)
 * - 52P-1234 (Ô tô 4 số cũ)
 * - 59H1-1234 (Xe máy 4 số cũ)
 */
export function validateVietnamPlate(cleanPlate: string): PlateValidationResult {
  const clean = cleanPlate.toUpperCase().replace(/[^0-9A-Z]/g, "");

  if (clean.length < 6 || clean.length > 10) {
    return {
      isValid: false,
      provinceCode: "",
      series: "",
      numberPart: "",
      vehicleTypeHint: "UNKNOWN",
      reason: "Độ dài ký tự không phù hợp biển số Việt Nam (6-10 ký tự)",
    };
  }

  const prov = clean.slice(0, 2);
  if (!VALID_VN_PROVINCES.has(prov)) {
    return {
      isValid: false,
      provinceCode: prov,
      series: "",
      numberPart: "",
      vehicleTypeHint: "UNKNOWN",
      reason: `Mã tỉnh ${prov} không thuộc danh mục 63 tỉnh thành Việt Nam`,
    };
  }

  // 1. Xe máy 5 số: 2 số tỉnh + 1 chữ + 1 ký tự (số/chữ) + 5 số (Tổng 9 ký tự, VD: 59H188912, 51MD12345)
  const moto5Match = clean.match(/^(\d{2})([A-Z][0-9A-Z])(\d{5})$/);
  if (moto5Match) {
    return {
      isValid: true,
      provinceCode: moto5Match[1],
      series: moto5Match[2],
      numberPart: moto5Match[3],
      vehicleTypeHint: "XE_MAY",
    };
  }

  // 2. Xe máy 4 số cũ có series kèm số: 2 số tỉnh + 1 chữ + 1 số + 4 số (Tổng 8 ký tự, VD: 59H11234)
  const moto4WithDigitMatch = clean.match(/^(\d{2})([A-Z]\d)(\d{4})$/);
  if (moto4WithDigitMatch) {
    return {
      isValid: true,
      provinceCode: moto4WithDigitMatch[1],
      series: moto4WithDigitMatch[2],
      numberPart: moto4WithDigitMatch[3],
      vehicleTypeHint: "XE_MAY",
    };
  }

  // 3. Ô tô 5 số: 2 số tỉnh + 1 chữ + 5 số (Tổng 8 ký tự, VD: 51H91991, 30A12345)
  const car5Match = clean.match(/^(\d{2})([A-Z])(\d{5})$/);
  if (car5Match) {
    return {
      isValid: true,
      provinceCode: car5Match[1],
      series: car5Match[2],
      numberPart: car5Match[3],
      vehicleTypeHint: "O_TO",
    };
  }

  // 4. Xe máy 4 số cũ có 2 chữ cái series: 2 số tỉnh + 2 chữ + 4 số (Tổng 8 ký tự, VD: 51AB1234)
  const moto4WithAlphaMatch = clean.match(/^(\d{2})([A-Z]{2})(\d{4})$/);
  if (moto4WithAlphaMatch) {
    return {
      isValid: true,
      provinceCode: moto4WithAlphaMatch[1],
      series: moto4WithAlphaMatch[2],
      numberPart: moto4WithAlphaMatch[3],
      vehicleTypeHint: "XE_MAY",
    };
  }

  // 5. Ô tô 4 số cũ: 2 số tỉnh + 1 chữ + 4 số (Tổng 7 ký tự, VD: 52P1234)
  const car4Match = clean.match(/^(\d{2})([A-Z])(\d{4})$/);
  if (car4Match) {
    return {
      isValid: true,
      provinceCode: car4Match[1],
      series: car4Match[2],
      numberPart: car4Match[3],
      vehicleTypeHint: "O_TO",
    };
  }

  return {
    isValid: false,
    provinceCode: prov,
    series: "",
    numberPart: "",
    vehicleTypeHint: "UNKNOWN",
    reason: "Cấu trúc chuỗi không khớp mẫu biển số xe Việt Nam",
  };
}
