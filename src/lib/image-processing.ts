/**
 * Bộ tiền xử lý ảnh trên Canvas chuyên dụng cho biển số xe Việt Nam
 * 100% chạy cục bộ trên Client (Canvas API / JavaScript), không sử dụng AI API.
 * Áp dụng thuật toán Adaptive Local Thresholding (Bradley-Roth / Sauvola) + Integral Image.
 */

export type PreprocessOptions = {
  windowSize?: number; // Kích thước cửa sổ lân cận (VD: 25)
  thresholdPercent?: number; // % độ lệch so với trung bình cục bộ (VD: 15%)
  contrast?: number;
  brightness?: number;
};

/**
 * Tải ảnh vào Canvas chuẩn hóa kích thước
 */
export async function loadImageToCanvas(source: File | Blob | string): Promise<{
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxDim = 1200;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        reject(new Error("Không thể tạo Canvas Context"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve({ canvas, ctx, width: w, height: h });
    };

    img.onerror = () => reject(new Error("Không thể tải ảnh"));

    if (typeof source === "string") {
      img.src = source;
    } else {
      img.src = URL.createObjectURL(source);
    }
  });
}

/**
 * Thuật toán Phân ngưỡng thích ứng cục bộ (Adaptive Integral Thresholding - Bradley & Roth)
 * Khắc phục triệt để bóng mờ, chói sáng, góc nghiêng trên biển số xe
 */
export function applyAdaptiveLocalThreshold(
  canvas: HTMLCanvasElement,
  options: PreprocessOptions = {}
): HTMLCanvasElement {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 1. Chuyển sang ảnh Grayscale
  const grayscale = new Uint8ClampedArray(width * height);
  const contrast = options.contrast ?? 1.2;
  const brightness = options.brightness ?? 5;

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const adj = (gray - 128) * contrast + 128 + brightness;
    grayscale[j] = Math.min(255, Math.max(0, adj));
  }

  // 2. Tính Bảng Tổng Tích phân (Integral Image) để tính trung bình O(1)
  const integral = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      sum += grayscale[idx];
      if (y === 0) {
        integral[idx] = sum;
      } else {
        integral[idx] = integral[(y - 1) * width + x] + sum;
      }
    }
  }

  // 3. Phân ngưỡng theo cửa sổ lân cận (Window Size S x S)
  const S = options.windowSize ?? Math.max(15, Math.round(width / 16));
  const s2 = Math.floor(S / 2);
  const T = (options.thresholdPercent ?? 15) / 100;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - s2);
      const x2 = Math.min(width - 1, x + s2);
      const y1 = Math.max(0, y - s2);
      const y2 = Math.min(height - 1, y + s2);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);

      // Tính tổng giá trị trong cửa sổ từ bảng tích phân
      const sum =
        integral[y2 * width + x2] -
        (y1 > 0 ? integral[(y1 - 1) * width + x2] : 0) -
        (x1 > 0 ? integral[y2 * width + (x1 - 1)] : 0) +
        (x1 > 0 && y1 > 0 ? integral[(y1 - 1) * width + (x1 - 1)] : 0);

      const mean = sum / count;
      const idx = y * width + x;
      const pixel = grayscale[idx];

      // Nếu pixel tối hơn trung bình cục bộ một lượng T% -> là chữ số (màu đen)
      // Ngược lại là nền biển số (màu trắng)
      const val = pixel < mean * (1 - T) ? 0 : 255;

      const dataIdx = idx * 4;
      data[dataIdx] = val;
      data[dataIdx + 1] = val;
      data[dataIdx + 2] = val;
      data[dataIdx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Tạo bản sao Canvas có tăng cường tương phản và độ nét (High Contrast Grayscale)
 */
export function applyHighContrastSharp(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const target = document.createElement("canvas");
  target.width = canvas.width;
  target.height = canvas.height;
  const ctx = target.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.drawImage(canvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, target.width, target.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    // Đường cong Sigmoid tăng tương phản cực đại chữ và nền
    let val = gray;
    if (gray < 110) {
      val = Math.max(0, gray * 0.5); // Làm đen đậm các ký tự
    } else if (gray > 140) {
      val = Math.min(255, 255 - (255 - gray) * 0.4); // Làm trắng sáng nền
    }
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }

  ctx.putImageData(imgData, 0, 0);
  return target;
}

/**
 * Cắt đúng vùng khung quét trung tâm và phóng to nếu cần để đảm bảo độ phân giải OCR tốt nhất
 */
export function cropCenterRegion(
  sourceCanvas: HTMLCanvasElement,
  regionRatio: { x: number; y: number; width: number; height: number } = {
    x: 0.05,
    y: 0.2,
    width: 0.9,
    height: 0.6,
  }
): HTMLCanvasElement {
  const sx = Math.max(0, Math.round(sourceCanvas.width * regionRatio.x));
  const sy = Math.max(0, Math.round(sourceCanvas.height * regionRatio.y));
  const sw = Math.min(sourceCanvas.width - sx, Math.round(sourceCanvas.width * regionRatio.width));
  const sh = Math.min(sourceCanvas.height - sy, Math.round(sourceCanvas.height * regionRatio.height));

  // Đảm bảo kích thước tối thiểu ~600px để OCR nhận diện ký tự cực nét
  let targetW = sw;
  let targetH = sh;
  const minWidth = 700;
  if (targetW < minWidth && targetW > 0) {
    const scale = minWidth / targetW;
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);
  }

  const targetCanvas = document.createElement("canvas");
  targetCanvas.width = targetW;
  targetCanvas.height = targetH;

  const targetCtx = targetCanvas.getContext("2d", { willReadFrequently: true });
  if (targetCtx) {
    targetCtx.imageSmoothingEnabled = true;
    targetCtx.imageSmoothingQuality = "high";
    targetCtx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, targetW, targetH);
  }
  return targetCanvas;
}

/**
 * Tạo bản sao Canvas thang độ xám tiêu chuẩn (Grayscale Standard)
 */
export function applyGrayscale(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const target = document.createElement("canvas");
  target.width = canvas.width;
  target.height = canvas.height;
  const ctx = target.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.drawImage(canvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, target.width, target.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imgData, 0, 0);
  return target;
}

