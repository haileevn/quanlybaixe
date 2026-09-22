export type ANPRMode = "AUTO" | "LOCAL_ONLY" | "AI_ONLY";

export type ANPRSource = "local" | "ai" | "heuristic";

export interface DetectionBox {
  x: number; // 0..1 ratio or pixel coordinate
  y: number;
  width: number;
  height: number;
  confidence: number;
  classId?: number;
  label?: string;
}

export interface ImageQualityMetrics {
  isBlurry: boolean;
  blurScore: number; // Laplacian variance / gradient sharpness (higher = sharper)
  brightness: number; // 0..255 average
  contrast: number; // standard deviation or dynamic range
  isAdequateSize: boolean;
  reason?: string;
}

export interface OCRResult {
  rawText: string;
  confidence: number; // 0..100
  words: {
    text: string;
    confidence: number;
    bbox?: { x0: number; y0: number; x1: number; y1: number };
  }[];
  processedCanvas?: HTMLCanvasElement;
}

export interface OCRProvider {
  name: string;
  recognize(canvas: HTMLCanvasElement): Promise<OCRResult>;
  terminate?(): Promise<void>;
}

export interface ANPRResult {
  plate: string; // Formatted display: "51H-919.91"
  canonical: string; // Cleaned storage key: "51H91991"
  detectionConfidence: number; // 0..1
  ocrConfidence: number; // 0..1
  finalConfidence: number; // 0..1
  source: ANPRSource;
  detectorSource: "onnx_yolo" | "heuristic_roi" | "ai_vision";
  isValidPattern: boolean;
  isStable: boolean;
  processingTimeMs: number;
  rawText: string;
  quality: ImageQualityMetrics;
  capturedImageUrl?: string;
}

export interface ScanFrameOptions {
  mode?: ANPRMode;
  attemptIndex?: number;
  maxAttempts?: number;
  acceptThreshold?: number; // default 0.88
  retryThreshold?: number; // default 0.65
  forceAi?: boolean;
}

export interface VotingCandidate {
  plate: string;
  count: number;
  totalVotes: number;
  consensusRatio: number; // e.g. 4/5 = 0.8
  lastConfidence: number;
  firstSeenAt: number;
  lastSeenAt: number;
}

export interface ANPRTelemetry {
  totalScans: number;
  localSuccess: number;
  aiFallback: number;
  aiSuccess: number;
  failed: number;
  apiAvoided: number;
}
