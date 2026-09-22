import { VALID_VN_PROVINCES } from "./validator";

/**
 * Sửa lỗi ký tự chữ thành số trong vị trí bắt buộc phải là CHỮ SỐ (Mã tỉnh & Dãy số sau)
 */
export function sanitizeDigitInNumberPosition(char: string): string {
  const map: Record<string, string> = {
    O: "0",
    o: "0",
    Q: "0",
    D: "0",
    I: "1",
    l: "1",
    "|": "1",
    Z: "2",
    z: "2",
    S: "5",
    s: "5",
    B: "8",
    G: "6",
  };
  return map[char] ?? char;
}

/**
 * Sửa lỗi chữ số bị nhận diện nhầm trong vị trí bắt buộc phải là CHỮ CÁI SERIES
 */
export function sanitizeAlphaInSeriesPosition(char: string): string {
  const map: Record<string, string> = {
    "0": "D",
    "8": "B",
    "1": "T",
    "5": "S",
    "2": "Z",
    "6": "G",
  };
  return map[char] ?? char.toUpperCase();
}

/**
 * Chuẩn hóa biển số xe về dạng canonical để lưu DB và tìm kiếm nhất quán (VD: 51H91991, 59H188912)
 */
export function canonicalPlate(plate: string): string {
  return plate.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/**
 * Định dạng hiển thị chuẩn: 59H1-889.12 hoặc 51H-919.91 hoặc 52P-1234
 */
export function formatPlateDisplay(plate: string): string {
  if (plate.includes("-")) {
    const parts = plate.toUpperCase().split("-");
    const head = parts[0].replace(/[^0-9A-Z]/g, "");
    const tail = parts.slice(1).join("").replace(/[^0-9A-Z]/g, "");
    if (head && tail) {
      if (tail.length === 5) {
        return `${head}-${tail.slice(0, 3)}.${tail.slice(3)}`;
      }
      return `${head}-${tail}`;
    }
  }

  const clean = canonicalPlate(plate);
  if (clean.length < 6) return clean;

  // 1. Xe máy 5 số: 9 ký tự (VD: 59H188912 -> 59H1-889.12)
  const moto5 = clean.match(/^(\d{2}[A-Z][0-9A-Z])(\d{5})$/);
  if (moto5 && VALID_VN_PROVINCES.has(moto5[1].slice(0, 2))) {
    return `${moto5[1]}-${moto5[2].slice(0, 3)}.${moto5[2].slice(3)}`;
  }

  // 2. Xe máy TP.HCM 59 4 số cũ: 8 ký tự (VD: 59H11234 -> 59H1-1234)
  const moto59_4 = clean.match(/^(59[A-Z][0-9A-Z])(\d{4})$/);
  if (moto59_4) {
    return `${moto59_4[1]}-${moto59_4[2]}`;
  }

  // 3. Ô tô 5 số: 8 ký tự (VD: 51H91991 -> 51H-919.91, 30A12345 -> 30A-123.45)
  const car5 = clean.match(/^(\d{2}[A-Z])(\d{5})$/);
  if (car5 && VALID_VN_PROVINCES.has(car5[1].slice(0, 2))) {
    return `${car5[1]}-${car5[2].slice(0, 3)}.${car5[2].slice(3)}`;
  }

  // 4. Xe máy 4 số: 8 ký tự (VD: 59H11234 -> 59H1-1234)
  const moto4 = clean.match(/^(\d{2}[A-Z][0-9A-Z])(\d{4})$/);
  if (moto4 && VALID_VN_PROVINCES.has(moto4[1].slice(0, 2))) {
    return `${moto4[1]}-${moto4[2]}`;
  }

  // 4. Ô tô 4 số cũ: 7 ký tự (VD: 52P1234 -> 52P-1234)
  const car4 = clean.match(/^(\d{2}[A-Z])(\d{4})$/);
  if (car4 && VALID_VN_PROVINCES.has(car4[1].slice(0, 2))) {
    return `${car4[1]}-${car4[2]}`;
  }

  return clean;
}

export interface NormalizedPlateResult {
  formattedPlate: string; // "51H-919.91"
  canonicalPlate: string; // "51H91991"
  isValid: boolean;
  confidence: number;
  rawText: string;
  sourceType: "2_LINE" | "1_LINE" | "RAW";
}

/**
 * Bóc tách và chuẩn hóa biển số xe Việt Nam từ raw text của OCR
 * Hỗ trợ biển 2 dòng (xe máy, ô tô vuông) và biển 1 dòng (ô tô dài)
 */
export function normalizeVietnamPlate(rawText: string): NormalizedPlateResult {
  const raw = (rawText || "").toUpperCase().trim();
  if (!raw || raw.length < 4) {
    return {
      formattedPlate: "",
      canonicalPlate: "",
      isValid: false,
      confidence: 0,
      rawText: raw,
      sourceType: "RAW",
    };
  }

  // Tách dòng
  const lines = raw
    .split(/[\r\n]+/)
    .map((l) => l.trim().replace(/[^0-9A-Z]/g, ""))
    .filter((l) => l.length >= 2);

  // =========================================================================
  // TRƯỜNG HỢP 1: BIỂN SỐ 2 DÒNG (VD: Dòng 1: "51H" hoặc "59H1" / Dòng 2: "91991" hoặc "88912")
  // =========================================================================
  if (lines.length >= 2) {
    for (let i = 0; i < lines.length - 1; i++) {
      const line1 = lines[i];
      const line2 = lines[i + 1];

      if (line1.length >= 3 && line1.length <= 5) {
        // 2 ký tự đầu bắt buộc là mã tỉnh (chỉ sửa nhầm lẫn số chữ cái rõ ràng như O->0, S->5 nếu đứng trước chữ cái)
        const p1 = line1[0] === "O" ? "0" : sanitizeDigitInNumberPosition(line1[0]);
        const p2 = line1[1] === "O" ? "0" : sanitizeDigitInNumberPosition(line1[1]);
        const prov = p1 + p2;

        if (VALID_VN_PROVINCES.has(prov)) {
          const seriesChar = sanitizeAlphaInSeriesPosition(line1[2]);
          const seriesSub = line1.length >= 4 ? line1.slice(3) : "";

          if (/^[A-Z]$/.test(seriesChar)) {
            const head = `${prov}${seriesChar}${seriesSub}`;

            // Dòng 2 là các chữ số
            const digits = line2
              .split("")
              .map(sanitizeDigitInNumberPosition)
              .filter((c) => /\d/.test(c))
              .join("");

            if (digits.length === 5 || digits.length === 4) {
              const combined = `${head}${digits}`;
              const formatted =
                digits.length === 5
                  ? `${head}-${digits.slice(0, 3)}.${digits.slice(3)}`
                  : `${head}-${digits}`;

              return {
                formattedPlate: formatted,
                canonicalPlate: combined,
                isValid: true,
                confidence: 0.98,
                rawText: raw,
                sourceType: "2_LINE",
              };
            }
          }
        }
      }
    }
  }

  // =========================================================================
  // TRƯỜNG HỢP 2: BIỂN SỐ 1 DÒNG HOẶC CHUỖI LIỀN NHAU
  // =========================================================================
  // Nếu chuỗi có dấu gạch ngang phân tách rõ ràng (VD: "51H-919.91", "30A-123.45", "59H1-889.12")
  if (raw.includes("-")) {
    const parts = raw.split("-");
    const h = parts[0].replace(/[^0-9A-Z]/g, "");
    const t = parts.slice(1).join("").replace(/[^0-9A-Z]/g, "");
    if (h.length >= 3 && h.length <= 4 && (t.length === 5 || t.length === 4)) {
      const p = h.slice(0, 2);
      if (VALID_VN_PROVINCES.has(p)) {
        const canonical = `${h}${t}`;
        const formatted =
          t.length === 5 ? `${h}-${t.slice(0, 3)}.${t.slice(3)}` : `${h}-${t}`;
        return {
          formattedPlate: formatted,
          canonicalPlate: canonical,
          isValid: true,
          confidence: 0.99,
          rawText: raw,
          sourceType: "1_LINE",
        };
      }
    }
  }

  const clean = raw.replace(/[^0-9A-Z]/g, "");

  // Tìm chuỗi con khớp mẫu biển số Việt Nam (Mã tỉnh BẮT BUỘC là 2 chữ số thực tế, KHÔNG convert bừa chữ cái)
  for (let len = 10; len >= 7; len--) {
    for (let start = 0; start <= clean.length - len; start++) {
      const sub = clean.slice(start, start + len);
      const prov = sub.slice(0, 2);

      // Mã tỉnh BẮT BUỘC là 2 chữ số thực sự
      if (!/^\d{2}$/.test(prov) || !VALID_VN_PROVINCES.has(prov)) continue;

      // 1. Xe máy 5 số: 9 ký tự (VD: 59H188912)
      if (len === 9) {
        const series1 = sanitizeAlphaInSeriesPosition(sub[2]);
        const series2 = sub[3];
        const num5 = sub.slice(4).split("").map(sanitizeDigitInNumberPosition).join("");
        if (/^[A-Z]$/.test(series1) && /^[0-9A-Z]$/.test(series2) && /^\d{5}$/.test(num5)) {
          const candidate = `${prov}${series1}${series2}${num5}`;
          return {
            formattedPlate: `${prov}${series1}${series2}-${num5.slice(0, 3)}.${num5.slice(3)}`,
            canonicalPlate: candidate,
            isValid: true,
            confidence: 0.97,
            rawText: raw,
            sourceType: "1_LINE",
          };
        }
      }

      // 2. 8 ký tự: Biển số 59 xe máy 4 số hoặc Ô tô 5 số / Xe máy 4 số khác
      if (len === 8) {
        // Trường hợp đầu số 59 (chuyên xe máy TP.HCM) hoặc series 2 chữ: 59H11234 -> 59H1-1234
        if (prov === "59" || /^[A-Z]{2}$/.test(sub.slice(2, 4))) {
          const motoSeries1 = sanitizeAlphaInSeriesPosition(sub[2]);
          const motoSeries2 = sub[3];
          const motoNum4 = sub.slice(4).split("").map(sanitizeDigitInNumberPosition).join("");
          if (/^[A-Z]$/.test(motoSeries1) && /^[0-9A-Z]$/.test(motoSeries2) && /^\d{4}$/.test(motoNum4)) {
            const candidate = `${prov}${motoSeries1}${motoSeries2}${motoNum4}`;
            return {
              formattedPlate: `${prov}${motoSeries1}${motoSeries2}-${motoNum4}`,
              canonicalPlate: candidate,
              isValid: true,
              confidence: 0.95,
              rawText: raw,
              sourceType: "1_LINE",
            };
          }
        }

        // Ô tô 5 số: 8 ký tự (VD: 51H91991, 30A12345)
        const carSeries = sanitizeAlphaInSeriesPosition(sub[2]);
        const carNum5 = sub.slice(3).split("").map(sanitizeDigitInNumberPosition).join("");
        if (/^[A-Z]$/.test(carSeries) && /^\d{5}$/.test(carNum5)) {
          const candidate = `${prov}${carSeries}${carNum5}`;
          return {
            formattedPlate: `${prov}${carSeries}-${carNum5.slice(0, 3)}.${carNum5.slice(3)}`,
            canonicalPlate: candidate,
            isValid: true,
            confidence: 0.96,
            rawText: raw,
            sourceType: "1_LINE",
          };
        }

        // Xe máy 4 số khác: 8 ký tự (VD: 51H11234)
        const motoSeries1 = sanitizeAlphaInSeriesPosition(sub[2]);
        const motoSeries2 = sub[3];
        const motoNum4 = sub.slice(4).split("").map(sanitizeDigitInNumberPosition).join("");
        if (/^[A-Z]$/.test(motoSeries1) && /^[0-9A-Z]$/.test(motoSeries2) && /^\d{4}$/.test(motoNum4)) {
          const candidate = `${prov}${motoSeries1}${motoSeries2}${motoNum4}`;
          return {
            formattedPlate: `${prov}${motoSeries1}${motoSeries2}-${motoNum4}`,
            canonicalPlate: candidate,
            isValid: true,
            confidence: 0.95,
            rawText: raw,
            sourceType: "1_LINE",
          };
        }
      }

      // 3. Ô tô 4 số cũ: 7 ký tự (VD: 52P1234)
      if (len === 7) {
        const carSeries = sanitizeAlphaInSeriesPosition(sub[2]);
        const carNum4 = sub.slice(3).split("").map(sanitizeDigitInNumberPosition).join("");
        if (/^[A-Z]$/.test(carSeries) && /^\d{4}$/.test(carNum4)) {
          const candidate = `${prov}${carSeries}${carNum4}`;
          return {
            formattedPlate: `${prov}${carSeries}-${carNum4}`,
            canonicalPlate: candidate,
            isValid: true,
            confidence: 0.93,
            rawText: raw,
            sourceType: "1_LINE",
          };
        }
      }
    }
  }

  // Fallback nếu không tìm thấy mẫu chuẩn
  return {
    formattedPlate: "",
    canonicalPlate: "",
    isValid: false,
    confidence: 0,
    rawText: raw,
    sourceType: "RAW",
  };
}
