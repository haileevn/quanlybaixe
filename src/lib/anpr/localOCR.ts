import { createWorker, PSM, type Worker } from "tesseract.js";
import type { OCRProvider, OCRResult } from "./types";
import { cropAndPreprocessPlate } from "./preprocess";
import { normalizeVietnamPlate } from "./normalize";

function extractWords(data: unknown): Array<{ text: string; confidence: number }> {
  const d = data as { words?: Array<{ text: string; confidence: number }> };
  if (Array.isArray(d?.words)) {
    return d.words.map((w) => ({
      text: w.text || "",
      confidence: typeof w.confidence === "number" ? w.confidence : 0,
    }));
  }
  return [];
}

export class TesseractOCRProvider implements OCRProvider {
  public name = "Tesseract.js (Offline WebAssembly)";
  private worker: Worker | null = null;
  private isInit = false;

  private async getWorker(): Promise<Worker> {
    if (this.worker) return this.worker;
    if (this.isInit) {
      await new Promise((r) => setTimeout(r, 150));
      return this.getWorker();
    }

    this.isInit = true;
    try {
      const w = await createWorker("eng");
      await w.setParameters({
        tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-.\n ",
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      });
      this.worker = w;
      return w;
    } finally {
      this.isInit = false;
    }
  }

  public async recognize(croppedCanvas: HTMLCanvasElement): Promise<OCRResult> {
    const worker = await this.getWorker();

    // Tạo các biến thể tiền xử lý chất lượng cao
    const variants = cropAndPreprocessPlate(croppedCanvas, {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      confidence: 1,
    });

    // Pass 1: Adaptive Local Threshold (Bradley-Roth)
    const res1 = await worker.recognize(variants.enhancedCrop);
    const parsed1 = normalizeVietnamPlate(res1.data.text);

    if (parsed1.isValid && parsed1.confidence >= 0.95) {
      return {
        rawText: res1.data.text,
        confidence: Math.round(res1.data.confidence),
        words: extractWords(res1.data),
        processedCanvas: variants.enhancedCrop,
      };
    }

    // Pass 2: High Contrast Sharpening
    const res2 = await worker.recognize(variants.sharpCrop);
    const parsed2 = normalizeVietnamPlate(res2.data.text);

    if (parsed2.isValid && parsed2.confidence >= 0.95) {
      return {
        rawText: res2.data.text,
        confidence: Math.round(res2.data.confidence),
        words: extractWords(res2.data),
        processedCanvas: variants.sharpCrop,
      };
    }

    // Pass 3: Grayscale Normalized (Nền sáng / Màn hình điện thoại)
    const res3 = await worker.recognize(variants.grayscaleCrop);
    const parsed3 = normalizeVietnamPlate(res3.data.text);

    if (parsed3.isValid) {
      return {
        rawText: res3.data.text,
        confidence: Math.round(res3.data.confidence),
        words: extractWords(res3.data),
        processedCanvas: variants.grayscaleCrop,
      };
    }

    // Chọn kết quả có độ tự tin cao nhất
    const passes = [
      { res: res1, canvas: variants.enhancedCrop, p: parsed1 },
      { res: res2, canvas: variants.sharpCrop, p: parsed2 },
      { res: res3, canvas: variants.grayscaleCrop, p: parsed3 },
    ];
    passes.sort((a, b) => b.res.data.confidence - a.res.data.confidence);
    const best = passes[0];

    return {
      rawText: best.res.data.text,
      confidence: Math.round(best.res.data.confidence),
      words: extractWords(best.res.data),
      processedCanvas: best.canvas,
    };
  }

  public async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

// Singleton OCR Provider
export const defaultOCRProvider = new TesseractOCRProvider();
