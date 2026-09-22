import type { DetectionBox, ImageQualityMetrics } from "./types";

/**
 * Đánh giá chất lượng ảnh (Độ mờ, Độ sáng, Độ tương phản, Kích thước)
 * Chống lãng phí API khi camera bị rung/mờ.
 */
export function assessImageQuality(
  canvas: HTMLCanvasElement,
  bbox?: DetectionBox
): ImageQualityMetrics {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return {
      isBlurry: false,
      blurScore: 100,
      brightness: 128,
      contrast: 50,
      isAdequateSize: true,
    };
  }

  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let totalBrightness = 0;
  const pixelCount = w * h;
  const grayArray = new Uint8Array(pixelCount);

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const gray = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    grayArray[j] = gray;
    totalBrightness += gray;
  }

  const avgBrightness = totalBrightness / pixelCount;

  // Tính độ tương phản (Standard Deviation)
  let varianceSum = 0;
  for (let i = 0; i < pixelCount; i++) {
    varianceSum += Math.pow(grayArray[i] - avgBrightness, 2);
  }
  const contrast = Math.sqrt(varianceSum / pixelCount);

  // Tính độ nét bằng biến thiên Gradient Laplacian
  let laplacianSum = 0;
  let edgeCount = 0;
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const idx = y * w + x;
      // 4-neighbor Laplacian operator: L = 4*I(x,y) - I(x+1,y) - I(x-1,y) - I(x,y+1) - I(x,y-1)
      const center = grayArray[idx];
      const lap = Math.abs(
        4 * center -
          grayArray[idx + 1] -
          grayArray[idx - 1] -
          grayArray[idx + w] -
          grayArray[idx - w]
      );
      laplacianSum += lap;
      edgeCount++;
    }
  }

  const blurScore = edgeCount > 0 ? laplacianSum / edgeCount : 0;
  // blurScore < 8 thường là ảnh quá mờ / đang lia máy
  const isBlurry = blurScore < 8.5;

  const isAdequateSize = bbox ? bbox.width >= 0.15 && bbox.height >= 0.08 : w >= 200;

  return {
    isBlurry,
    blurScore: Math.round(blurScore * 10) / 10,
    brightness: Math.round(avgBrightness),
    contrast: Math.round(contrast),
    isAdequateSize,
    reason: isBlurry
      ? "Khung hình bị mờ hoặc camera đang chuyển động."
      : !isAdequateSize
      ? "Biển số ở quá xa hoặc quá nhỏ."
      : undefined,
  };
}

export interface PreprocessVariants {
  originalCrop: HTMLCanvasElement;
  enhancedCrop: HTMLCanvasElement;
  sharpCrop: HTMLCanvasElement;
  grayscaleCrop: HTMLCanvasElement;
}

/**
 * Cắt biển số từ khung hình gốc và tạo các biến thể tiền xử lý chất lượng cao
 */
export function cropAndPreprocessPlate(
  sourceCanvas: HTMLCanvasElement,
  bbox: DetectionBox = { x: 0.1, y: 0.2, width: 0.8, height: 0.6, confidence: 1 }
): PreprocessVariants {
  const sx = Math.max(0, Math.round(sourceCanvas.width * bbox.x));
  const sy = Math.max(0, Math.round(sourceCanvas.height * bbox.y));
  const sw = Math.min(
    sourceCanvas.width - sx,
    Math.round(sourceCanvas.width * bbox.width)
  );
  const sh = Math.min(
    sourceCanvas.height - sy,
    Math.round(sourceCanvas.height * bbox.height)
  );

  // Phóng to 2x-3x (ít nhất 700px width) để ký tự đạt độ phân giải cao nhất cho OCR
  let targetW = Math.max(1, sw);
  let targetH = Math.max(1, sh);
  const minWidth = 720;
  if (targetW < minWidth) {
    const scale = minWidth / targetW;
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);
  }

  // 1. Original Crop
  const originalCrop = document.createElement("canvas");
  originalCrop.width = targetW;
  originalCrop.height = targetH;
  const origCtx = originalCrop.getContext("2d", { willReadFrequently: true });
  if (origCtx) {
    origCtx.imageSmoothingEnabled = true;
    origCtx.imageSmoothingQuality = "high";
    origCtx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, targetW, targetH);
  }

  // 2. Grayscale Crop
  const grayscaleCrop = document.createElement("canvas");
  grayscaleCrop.width = targetW;
  grayscaleCrop.height = targetH;
  const grayCtx = grayscaleCrop.getContext("2d", { willReadFrequently: true });
  if (grayCtx && origCtx) {
    grayCtx.drawImage(originalCrop, 0, 0);
    const imgData = grayCtx.getImageData(0, 0, targetW, targetH);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
      d[i] = g;
      d[i + 1] = g;
      d[i + 2] = g;
    }
    grayCtx.putImageData(imgData, 0, 0);
  }

  // 3. Sharp Contrast Crop (Sigmoid contrast enhancement)
  const sharpCrop = document.createElement("canvas");
  sharpCrop.width = targetW;
  sharpCrop.height = targetH;
  const sharpCtx = sharpCrop.getContext("2d", { willReadFrequently: true });
  if (sharpCtx && grayCtx) {
    sharpCtx.drawImage(grayscaleCrop, 0, 0);
    const imgData = sharpCtx.getImageData(0, 0, targetW, targetH);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = d[i];
      let val = g;
      if (g < 110) {
        val = Math.max(0, g * 0.5); // Làm đen đậm chữ số
      } else if (g > 140) {
        val = Math.min(255, 255 - (255 - g) * 0.4); // Làm sáng trắng nền biển số
      }
      d[i] = val;
      d[i + 1] = val;
      d[i + 2] = val;
    }
    sharpCtx.putImageData(imgData, 0, 0);
  }

  // 4. Enhanced Crop (Adaptive Integral Thresholding - Bradley & Roth)
  const enhancedCrop = document.createElement("canvas");
  enhancedCrop.width = targetW;
  enhancedCrop.height = targetH;
  const enhCtx = enhancedCrop.getContext("2d", { willReadFrequently: true });
  if (enhCtx && origCtx) {
    enhCtx.drawImage(originalCrop, 0, 0);
    applyAdaptiveThreshold(enhancedCrop);
  }

  return {
    originalCrop,
    enhancedCrop,
    sharpCrop,
    grayscaleCrop,
  };
}

function applyAdaptiveThreshold(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const grayscale = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const gray = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    grayscale[j] = Math.min(255, Math.max(0, (gray - 128) * 1.2 + 133));
  }

  // Integral Image
  const integral = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      sum += grayscale[idx];
      integral[idx] = y === 0 ? sum : integral[(y - 1) * w + x] + sum;
    }
  }

  const S = Math.max(15, Math.round(w / 16));
  const s2 = Math.floor(S / 2);
  const T = 0.15; // 15% threshold

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - s2);
      const x2 = Math.min(w - 1, x + s2);
      const y1 = Math.max(0, y - s2);
      const y2 = Math.min(h - 1, y + s2);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);

      const sum =
        integral[y2 * w + x2] -
        (y1 > 0 ? integral[(y1 - 1) * w + x2] : 0) -
        (x1 > 0 ? integral[y2 * w + (x1 - 1)] : 0) +
        (x1 > 0 && y1 > 0 ? integral[(y1 - 1) * w + (x1 - 1)] : 0);

      const mean = sum / count;
      const idx = y * w + x;
      const pixel = grayscale[idx];
      const val = pixel < mean * (1 - T) ? 0 : 255;

      const dataIdx = idx * 4;
      data[dataIdx] = val;
      data[dataIdx + 1] = val;
      data[dataIdx + 2] = val;
      data[dataIdx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}
