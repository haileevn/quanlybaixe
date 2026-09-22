import type { ANPRResult, ScanFrameOptions, ImageQualityMetrics } from "./types";
import { assessImageQuality, cropAndPreprocessPlate } from "./preprocess";
import { detectPlate } from "./detector";
import { defaultOCRProvider } from "./localOCR";
import { normalizeVietnamPlate, formatPlateDisplay, canonicalPlate } from "./normalize";
import { validateVietnamPlate } from "./validator";
import { calculateConfidence } from "./confidence";
import { MultiFrameVoting } from "./voting";
import { anprDeduplicator } from "./dedup";
import { anprStats } from "./stats";
import { recognizePlateWithAIAction } from "@/actions/plate-ai";

const globalVoting = new MultiFrameVoting(5);

export const LOCAL_ACCEPT_THRESHOLD = 0.88;
export const LOCAL_RETRY_THRESHOLD = 0.65;
export const MAX_LOCAL_ATTEMPTS = 3;

/**
 * Pipeline nhận diện biển số xe: LOCAL/OFFLINE FIRST -> AI FALLBACK
 */
export async function scanPlate(
  frameCanvas: HTMLCanvasElement,
  options: ScanFrameOptions = {}
): Promise<ANPRResult> {
  const startTime = performance.now();
  const mode = options.mode ?? "AUTO";
  const attemptIndex = options.attemptIndex ?? 1;
  const maxAttempts = options.maxAttempts ?? MAX_LOCAL_ATTEMPTS;
  const acceptThreshold = options.acceptThreshold ?? LOCAL_ACCEPT_THRESHOLD;
  const forceAi = options.forceAi ?? false;

  // 1. ĐÁNH GIÁ CHẤT LƯỢNG ẢNH (BLUR & QUALITY ASSESSMENT)
  const quality = assessImageQuality(frameCanvas);

  // Nếu ảnh bị quá mờ/rung và không ép buộc AI -> Bỏ qua, hiển thị "Giữ camera ổn định...", KHÔNG gọi AI
  if (quality.isBlurry && !forceAi && mode !== "AI_ONLY") {
    const elapsed = Math.round(performance.now() - startTime);
    return {
      plate: "",
      canonical: "",
      detectionConfidence: 0,
      ocrConfidence: 0,
      finalConfidence: 0,
      source: "local",
      detectorSource: "heuristic_roi",
      isValidPattern: false,
      isStable: false,
      processingTimeMs: elapsed,
      rawText: "",
      quality,
    };
  }

  // 2. NẾU CHẾ ĐỘ LÀ AI_ONLY HOẶC FORCE_AI -> GỌI TRỰC TIẾP AI
  if (mode === "AI_ONLY" || forceAi) {
    return await executeAiFallback(frameCanvas, quality, startTime);
  }

  // 3. BƯỚC 1 CỦA LOCAL FIRST: LOCAL PLATE DETECTION (YOLO / HEURISTIC)
  const detResult = await detectPlate(frameCanvas);
  const primaryBox = detResult.boxes[0] || {
    x: 0.1,
    y: 0.2,
    width: 0.8,
    height: 0.6,
    confidence: 0.9,
  };

  // 4. BƯỚC 2: CROP HIGH-RES & TIỀN XỬ LÝ CANVAS ĐA TẦNG
  const cropVariants = cropAndPreprocessPlate(frameCanvas, primaryBox);

  // 5. BƯỚC 3: LOCAL OCR PROVIDER (TESSERACT 3-PASS OFFLINE)
  const ocrRes = await defaultOCRProvider.recognize(cropVariants.enhancedCrop);

  // 6. BƯỚC 4: NORMALIZE & VALIDATE BIỂN SỐ VIỆT NAM
  const norm = normalizeVietnamPlate(ocrRes.rawText);

  // 7. BƯỚC 5: MULTI-FRAME VOTING & TÍNH ĐỘ TIN CẬY
  let consensusRatio = 1.0;
  if (norm.isValid) {
    const vote = globalVoting.push(norm.canonicalPlate, ocrRes.confidence / 100);
    if (vote) {
      consensusRatio = vote.consensusRatio;
    }
  }

  const finalConfidence = calculateConfidence({
    detectionConfidence: primaryBox.confidence,
    ocrConfidence: ocrRes.confidence / 100,
    isValidPattern: norm.isValid,
    quality,
    consensusRatio,
  });

  const elapsed = Math.round(performance.now() - startTime);

  // =========================================================================
  // DECISION ENGINE: LOCAL ACCEPT vs RETRY vs AI FALLBACK
  // =========================================================================

  // TRƯỜNG HỢP 1: LOCAL OCR THÀNH CÔNG VỚI ĐỘ TIN CẬY CAO (>= 0.88)
  if (norm.isValid && finalConfidence >= acceptThreshold) {
    anprStats.recordScan({ source: "local", success: true });

    return {
      plate: norm.formattedPlate,
      canonical: norm.canonicalPlate,
      detectionConfidence: primaryBox.confidence,
      ocrConfidence: Math.round(ocrRes.confidence) / 100,
      finalConfidence,
      source: "local",
      detectorSource: detResult.source,
      isValidPattern: true,
      isStable: consensusRatio >= 0.6,
      processingTimeMs: elapsed,
      rawText: ocrRes.rawText,
      quality,
    };
  }

  // TRƯỜNG HỢP 2: CHẾ ĐỘ LOCAL_ONLY -> KHÔNG BAO GIỜ GỌI AI
  if (mode === "LOCAL_ONLY") {
    anprStats.recordScan({ source: "local", success: norm.isValid });
    return {
      plate: norm.formattedPlate,
      canonical: norm.canonicalPlate,
      detectionConfidence: primaryBox.confidence,
      ocrConfidence: Math.round(ocrRes.confidence) / 100,
      finalConfidence,
      source: "local",
      detectorSource: detResult.source,
      isValidPattern: norm.isValid,
      isStable: false,
      processingTimeMs: elapsed,
      rawText: ocrRes.rawText,
      quality,
    };
  }

  // TRƯỜNG HỢP 3: CHƯA ĐẠT THRESHOLD NHƯNG VẪN CÒN SỐ LẦN RETRY LOCAL (< 3 LẦN)
  if (attemptIndex < maxAttempts) {
    return {
      plate: norm.formattedPlate,
      canonical: norm.canonicalPlate,
      detectionConfidence: primaryBox.confidence,
      ocrConfidence: Math.round(ocrRes.confidence) / 100,
      finalConfidence,
      source: "local",
      detectorSource: detResult.source,
      isValidPattern: norm.isValid,
      isStable: false,
      processingTimeMs: elapsed,
      rawText: ocrRes.rawText,
      quality,
    };
  }

  // TRƯỜNG HỢP 4: ĐÃ THỬ HẾT 3 LẦN LOCAL MÀ VẪN KHÔNG CHẮC CHẮN -> GỌI AI FALLBACK
  const fingerprint = anprDeduplicator.generateImageFingerprint(frameCanvas);

  if (anprDeduplicator.shouldThrottleAiCall(fingerprint)) {
    // Đang trong thời gian cooldown 10s của AI -> Dùng kết quả Local tốt nhất
    return {
      plate: norm.formattedPlate,
      canonical: norm.canonicalPlate,
      detectionConfidence: primaryBox.confidence,
      ocrConfidence: Math.round(ocrRes.confidence) / 100,
      finalConfidence,
      source: "local",
      detectorSource: detResult.source,
      isValidPattern: norm.isValid,
      isStable: false,
      processingTimeMs: elapsed,
      rawText: ocrRes.rawText,
      quality,
    };
  }

  // Thực thi AI Fallback
  return await executeAiFallback(frameCanvas, quality, startTime, norm.formattedPlate);
}

/**
 * Thực thi gọi AI API fallback khi Local OCR không chắc chắn
 */
async function executeAiFallback(
  frameCanvas: HTMLCanvasElement,
  quality: ImageQualityMetrics,
  startTime: number,
  fallbackLocalPlate?: string
): Promise<ANPRResult> {
  const base64 = frameCanvas.toDataURL("image/jpeg", 0.9);
  const fingerprint = anprDeduplicator.generateImageFingerprint(frameCanvas);

  try {
    const aiResult = await recognizePlateWithAIAction(base64);
    anprDeduplicator.markAiCall(fingerprint, aiResult.plateNumber);

    const elapsed = Math.round(performance.now() - startTime);

    if (aiResult.ok && aiResult.plateNumber) {
      const canonical = canonicalPlate(aiResult.plateNumber);
      const valid = validateVietnamPlate(canonical);

      anprStats.recordScan({ source: "ai", success: true });

      return {
        plate: formatPlateDisplay(aiResult.plateNumber),
        canonical,
        detectionConfidence: 0.99,
        ocrConfidence: 0.99,
        finalConfidence: 0.99,
        source: "ai",
        detectorSource: "ai_vision",
        isValidPattern: valid.isValid,
        isStable: true,
        processingTimeMs: elapsed,
        rawText: aiResult.plateNumber,
        quality,
      };
    }
  } catch (err) {
    console.warn("[ANPR] AI Fallback call failed:", err);
  }

  // Nếu AI lỗi hoặc không tìm thấy -> trả về kết quả local tốt nhất nếu có
  anprStats.recordScan({ source: "ai", success: false });
  const elapsed = Math.round(performance.now() - startTime);

  return {
    plate: fallbackLocalPlate || "",
    canonical: canonicalPlate(fallbackLocalPlate || ""),
    detectionConfidence: 0,
    ocrConfidence: 0,
    finalConfidence: 0,
    source: "local",
    detectorSource: "heuristic_roi",
    isValidPattern: Boolean(fallbackLocalPlate),
    isStable: false,
    processingTimeMs: elapsed,
    rawText: "",
    quality,
  };
}

export function resetVoting(): void {
  globalVoting.reset();
}
