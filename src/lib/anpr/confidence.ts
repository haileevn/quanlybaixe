import type { ImageQualityMetrics } from "./types";

export interface ConfidenceFactors {
  detectionConfidence: number; // 0..1
  ocrConfidence: number; // 0..1
  isValidPattern: boolean;
  quality?: ImageQualityMetrics;
  consensusRatio?: number; // 0..1 from multi-frame voting
}

/**
 * Tính điểm tin cậy tổng hợp (Final Confidence) cho quyết định Local Accept vs AI Fallback
 */
export function calculateConfidence(factors: ConfidenceFactors): number {
  const {
    detectionConfidence,
    ocrConfidence,
    isValidPattern,
    quality,
    consensusRatio = 1.0,
  } = factors;

  if (!isValidPattern) {
    return 0.0;
  }

  // Trọng số:
  // - Detection: 25%
  // - OCR: 40%
  // - Consensus/Stability: 25%
  // - Quality: 10%
  const detScore = Math.min(1.0, Math.max(0, detectionConfidence));
  const ocrScore = Math.min(1.0, Math.max(0, ocrConfidence));
  const voteScore = Math.min(1.0, Math.max(0, consensusRatio));

  let qualScore = 1.0;
  if (quality) {
    if (quality.isBlurry) qualScore *= 0.6;
    if (quality.brightness < 40 || quality.brightness > 230) qualScore *= 0.8;
    if (quality.contrast < 20) qualScore *= 0.8;
  }

  const finalScore =
    detScore * 0.25 + ocrScore * 0.4 + voteScore * 0.25 + qualScore * 0.1;

  return Math.round(finalScore * 100) / 100;
}
