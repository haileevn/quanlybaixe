import { createWorker, PSM, type Worker } from "tesseract.js";
import {
  applyAdaptiveLocalThreshold,
  applyHighContrastSharp,
  applyGrayscale,
} from "@/lib/image-processing";

let cachedWorker: Worker | null = null;
let isInitializing = false;

// 63 mã tỉnh thành phố hợp lệ tại Việt Nam
export const VALID_VN_PROVINCES = new Set([
  "11", "12", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24",
  "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37",
  "38", "40", "43", "47", "48", "49", "50", "51", "52", "53", "54", "55", "56",
  "57", "58", "59", "60", "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "70", "71", "72", "73", "74", "75", "76", "77", "78", "79", "81", "82", "83",
  "84", "85", "86", "88", "89", "90", "92", "93", "94", "95", "97", "98", "99",
]);

/**
 * Lấy hoặc khởi tạo WebAssembly Tesseract OCR Worker (100% Offline in-browser)
 */
async function getOcrWorker(): Promise<Worker> {
  if (cachedWorker) return cachedWorker;
  if (isInitializing) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return getOcrWorker();
  }

  isInitializing = true;
  try {
    const worker = await createWorker("eng");
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-./ \n",
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });
    cachedWorker = worker;
    return worker;
  } finally {
    isInitializing = false;
  }
}

/**
 * Chuẩn hóa ký tự chữ số/chữ cái khi đã xác định vị trí tương ứng
 */
export function sanitizeDigit(char: string): string {
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
  };
  return map[char] ?? char;
}

export function sanitizeAlpha(char: string): string {
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
 * Thuật toán bóc tách, sửa lỗi & chuẩn hóa biển số xe Việt Nam
 * Hỗ trợ cả biển số 2 dòng (xe máy, ô tô vuông) và biển 1 dòng (ô tô dài)
 */
export function extractVietnamesePlate(rawText: string): {
  plateNumber: string;
  confidence: number;
  isValidPattern: boolean;
  raw: string;
} {
  const raw = rawText.toUpperCase().trim();
  if (!raw || raw.length < 5) {
    return { plateNumber: "", confidence: 0, isValidPattern: false, raw };
  }

  // Tách từng dòng và làm sạch các ký tự không liên quan
  const rawLines = raw
    .split(/[\r\n]+/)
    .map((l) => l.trim().replace(/[^0-9A-Z]/g, ""))
    .filter((l) => l.length >= 2);

  // =========================================================================
  // TRƯỜNG HỢP 1: BIỂN SỐ 2 DÒNG (VD: Dòng 1: 51H hoặc 59H1 / Dòng 2: 91991 hoặc 88912)
  // =========================================================================
  if (rawLines.length >= 2) {
    for (let i = 0; i < rawLines.length - 1; i++) {
      const line1 = rawLines[i];
      const line2 = rawLines[i + 1];

      // Dòng 1: Phải có độ dài từ 3 đến 5 ký tự (VD: 51H, 29A, 59H1, 60B2, 51MD)
      if (line1.length >= 3 && line1.length <= 5) {
        // 2 ký tự đầu BẮT BUỘC là 2 chữ số tỉnh thành hợp lệ
        const provDigit1 = line1[0] === "O" ? "0" : line1[0];
        const provDigit2 = line1[1] === "O" ? "0" : line1[1];
        const prov = provDigit1 + provDigit2;

        if (VALID_VN_PROVINCES.has(prov)) {
          // Ký tự thứ 3 BẮT BUỘC là chữ cái series (A-Z)
          const seriesChar = sanitizeAlpha(line1[2]);
          // Ký tự thứ 4 (nếu có) có thể là số hoặc chữ phụ (VD: 1 trong H1, D trong MD)
          const seriesSub = line1.length >= 4 ? line1.slice(3) : "";

          // Kiểm tra series hợp lệ (chữ cái chuẩn)
          if (/^[A-Z]$/.test(seriesChar)) {
            const fixedHead = `${prov}${seriesChar}${seriesSub}`;

            // Dòng 2: BẮT BUỘC là 4 hoặc 5 chữ số
            const digitsLine2 = line2
              .split("")
              .map(sanitizeDigit)
              .filter((c) => /\d/.test(c))
              .join("");

            if (digitsLine2.length === 5 || digitsLine2.length === 4) {
              const formatted = formatPlateString(`${fixedHead}-${digitsLine2}`);
              return {
                plateNumber: formatted,
                confidence: 99,
                isValidPattern: true,
                raw,
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
  const clean = raw.replace(/[^0-9A-Z]/g, "");

  // Tìm kiếm pattern biển số trong toàn bộ chuỗi ký tự
  // 1. Xe máy 5 số: 2 số tỉnh + 1 chữ series + 1 ký tự phụ + 5 số (VD: 59H188912 -> 59H1-889.12)
  const moto5Match = clean.match(/(\d{2})([A-Z])([0-9A-Z])(\d{5})/);
  if (moto5Match && VALID_VN_PROVINCES.has(moto5Match[1])) {
    const formatted = formatPlateString(
      `${moto5Match[1]}${moto5Match[2]}${moto5Match[3]}-${moto5Match[4]}`
    );
    return {
      plateNumber: formatted,
      confidence: 98,
      isValidPattern: true,
      raw,
    };
  }

  // 2. Ô tô 5 số: 2 số tỉnh + 1 chữ series + 5 số (VD: 51H91991 -> 51H-919.91, 30A12345 -> 30A-123.45)
  const car5Match = clean.match(/(\d{2})([A-Z])(\d{5})/);
  if (car5Match && VALID_VN_PROVINCES.has(car5Match[1])) {
    const formatted = formatPlateString(`${car5Match[1]}${car5Match[2]}-${car5Match[3]}`);
    return {
      plateNumber: formatted,
      confidence: 97,
      isValidPattern: true,
      raw,
    };
  }

  // 3. Xe máy / Ô tô 4 số cũ: (VD: 59H11234 -> 59H1-1234, 51A1234 -> 51A-1234)
  const moto4Match = clean.match(/(\d{2})([A-Z])([0-9A-Z])(\d{4})/);
  if (moto4Match && VALID_VN_PROVINCES.has(moto4Match[1])) {
    const formatted = formatPlateString(
      `${moto4Match[1]}${moto4Match[2]}${moto4Match[3]}-${moto4Match[4]}`
    );
    return {
      plateNumber: formatted,
      confidence: 95,
      isValidPattern: true,
      raw,
    };
  }

  const car4Match = clean.match(/(\d{2})([A-Z])(\d{4})/);
  if (car4Match && VALID_VN_PROVINCES.has(car4Match[1])) {
    const formatted = formatPlateString(`${car4Match[1]}${car4Match[2]}-${car4Match[3]}`);
    return {
      plateNumber: formatted,
      confidence: 93,
      isValidPattern: true,
      raw,
    };
  }

  // Nếu không khớp với bất kỳ chuẩn biển số Việt Nam nào -> KHÔNG HỢP LỆ (TRÁNH RÁC TỪ PHÒNG/VẬT THỂ)
  return {
    plateNumber: "",
    confidence: 0,
    isValidPattern: false,
    raw,
  };
}

/**
 * Định dạng hiển thị chuẩn: 59H1-123.45 hoặc 51H-919.91
 */
export function formatPlateString(plate: string): string {
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

  const clean = plate.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (clean.length < 6) return clean;

  // Ô tô 5 số (VD: 51H91991 -> 51H-919.91)
  const carMatch5 = clean.match(/^(\d{2}[A-Z])(\d{5})$/);
  if (carMatch5) {
    return `${carMatch5[1]}-${carMatch5[2].slice(0, 3)}.${carMatch5[2].slice(3)}`;
  }

  // Xe máy 5 số (VD: 59H188912 -> 59H1-889.12)
  const motoMatch5 = clean.match(/^(\d{2}[A-Z][0-9A-Z])(\d{5})$/);
  if (motoMatch5) {
    return `${motoMatch5[1]}-${motoMatch5[2].slice(0, 3)}.${motoMatch5[2].slice(3)}`;
  }

  // Xe 4 số (VD: 59H11234 -> 59H1-1234, 51A1234 -> 51A-1234)
  const motoMatch4 = clean.match(/^(\d{2}[A-Z][0-9A-Z])(\d{4})$/);
  if (motoMatch4) {
    return `${motoMatch4[1]}-${motoMatch4[2]}`;
  }

  const carMatch4 = clean.match(/^(\d{2}[A-Z])(\d{4})$/);
  if (carMatch4) {
    return `${carMatch4[1]}-${carMatch4[2]}`;
  }

  return clean;
}

/**
 * Thực hiện nhận diện OCR đa tầng (Multi-pass OCR):
 * Pass 1: Adaptive Local Threshold (Khắc phục chói/bóng)
 * Pass 2: High Contrast Sharpening (Khắc phục ảnh mờ)
 * Pass 3: Grayscale chuẩn (Khắc phục ảnh màn hình điện thoại/biển số nền sáng)
 */
export async function recognizePlateFromCanvas(
  sourceCanvas: HTMLCanvasElement
): Promise<{
  plateNumber: string;
  confidence: number;
  isValidPattern: boolean;
  rawText: string;
  processedCanvas: HTMLCanvasElement;
}> {
  const worker = await getOcrWorker();

  // Pass 1: Adaptive Local Threshold
  const canvasPass1 = document.createElement("canvas");
  canvasPass1.width = sourceCanvas.width;
  canvasPass1.height = sourceCanvas.height;
  const ctx1 = canvasPass1.getContext("2d");
  ctx1?.drawImage(sourceCanvas, 0, 0);
  applyAdaptiveLocalThreshold(canvasPass1);

  const res1 = await worker.recognize(canvasPass1);
  const parsed1 = extractVietnamesePlate(res1.data.text);

  if (parsed1.isValidPattern && parsed1.confidence >= 90) {
    return {
      plateNumber: parsed1.plateNumber,
      confidence: parsed1.confidence,
      isValidPattern: true,
      rawText: res1.data.text,
      processedCanvas: canvasPass1,
    };
  }

  // Pass 2: High Contrast Sharpening
  const canvasPass2 = applyHighContrastSharp(sourceCanvas);
  const res2 = await worker.recognize(canvasPass2);
  const parsed2 = extractVietnamesePlate(res2.data.text);

  if (parsed2.isValidPattern && parsed2.confidence >= 90) {
    return {
      plateNumber: parsed2.plateNumber,
      confidence: parsed2.confidence,
      isValidPattern: true,
      rawText: res2.data.text,
      processedCanvas: canvasPass2,
    };
  }

  // Pass 3: Grayscale chuẩn
  const canvasPass3 = applyGrayscale(sourceCanvas);
  const res3 = await worker.recognize(canvasPass3);
  const parsed3 = extractVietnamesePlate(res3.data.text);

  if (parsed3.isValidPattern) {
    return {
      plateNumber: parsed3.plateNumber,
      confidence: parsed3.confidence,
      isValidPattern: true,
      rawText: res3.data.text,
      processedCanvas: canvasPass3,
    };
  }

  // Chọn kết quả có độ tin cậy cao nhất trong 3 pass
  const candidates = [
    { parsed: parsed1, res: res1, canvas: canvasPass1 },
    { parsed: parsed2, res: res2, canvas: canvasPass2 },
    { parsed: parsed3, res: res3, canvas: canvasPass3 },
  ];
  candidates.sort((a, b) => b.parsed.confidence - a.parsed.confidence);
  const best = candidates[0];

  return {
    plateNumber: best.parsed.plateNumber,
    confidence: best.parsed.confidence,
    isValidPattern: best.parsed.isValidPattern,
    rawText: best.res.data.text,
    processedCanvas: best.canvas,
  };
}
