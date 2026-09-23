import { createWorker, PSM, type Worker } from "tesseract.js";
import type { OCRProvider, OCRResult, DetectionBox } from "./types";
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

  public async recognize(
    sourceCanvas: HTMLCanvasElement,
    bbox?: DetectionBox
  ): Promise<OCRResult> {
    const worker = await this.getWorker();

    // 1. Tạo các biến thể tiền xử lý chất lượng cao từ bbox
    const variants = cropAndPreprocessPlate(sourceCanvas, bbox);

    const passes = [
      { canvas: variants.grayscaleCrop, name: "grayscale" },
      { canvas: variants.sharpCrop, name: "sharp" },
      { canvas: variants.enhancedCrop, name: "adaptive_threshold" },
      { canvas: variants.originalCrop, name: "original" },
    ];

    const results: Array<{
      rawText: string;
      confidence: number;
      words: Array<{ text: string; confidence: number }>;
      processedCanvas: HTMLCanvasElement;
      isValid: boolean;
    }> = [];

    for (const p of passes) {
      try {
        const res = await worker.recognize(p.canvas);
        const parsed = normalizeVietnamPlate(res.data.text);
        const entry = {
          rawText: res.data.text,
          confidence: Math.round(res.data.confidence),
          words: extractWords(res.data),
          processedCanvas: p.canvas,
          isValid: parsed.isValid,
        };

        // Nếu đã trích xuất được biển số hợp lệ với độ tự tin tốt -> Dừng sớm và trả về kết quả
        if (parsed.isValid && parsed.confidence >= 0.9) {
          return entry;
        }

        results.push(entry);
      } catch (err) {
        console.warn(`[OCR Pass ${p.name} failed]:`, err);
      }
    }

    // 2. Nếu bbox nhỏ chưa tìm thấy, thử quét trên toàn bộ khung hình Full Canvas (Grayscale)
    if (bbox && (bbox.width < 0.95 || bbox.height < 0.95)) {
      try {
        const fullVariants = cropAndPreprocessPlate(sourceCanvas, {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          confidence: 1,
        });
        const fullRes = await worker.recognize(fullVariants.sharpCrop);
        const fullParsed = normalizeVietnamPlate(fullRes.data.text);
        if (fullParsed.isValid) {
          return {
            rawText: fullRes.data.text,
            confidence: Math.round(fullRes.data.confidence),
            words: extractWords(fullRes.data),
            processedCanvas: fullVariants.sharpCrop,
          };
        }
      } catch {
        // ignore full scan error
      }
    }

    // 3. Trả về kết quả tốt nhất tìm được
    const validMatches = results.filter((r) => r.isValid);
    if (validMatches.length > 0) {
      validMatches.sort((a, b) => b.confidence - a.confidence);
      return validMatches[0];
    }

    if (results.length > 0) {
      results.sort((a, b) => b.confidence - a.confidence);
      return results[0];
    }

    return {
      rawText: "",
      confidence: 0,
      words: [],
      processedCanvas: sourceCanvas,
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
