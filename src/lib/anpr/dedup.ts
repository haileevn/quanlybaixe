/**
 * Quản lý Deduplication (Chống trùng lặp sự kiện) và Cooldown cho AI Fallback
 */

// Thời gian chống duplicate check-in/lookup cùng 1 biển số (5 giây)
export const SCAN_RESULT_COOLDOWN_MS = 5000;

// Thời gian cooldown không gọi lại AI API cho cùng một chuỗi ảnh (10 giây)
export const AI_FALLBACK_COOLDOWN_MS = 10000;

interface PlateSeenRecord {
  plate: string;
  lastLookedUpAt: number;
}

interface AICallRecord {
  fingerprint: string;
  lastCalledAt: number;
  resultPlate?: string;
}

class ANPRDeduplicator {
  private seenPlates = new Map<string, PlateSeenRecord>();
  private aiCallCache = new Map<string, AICallRecord>();

  /**
   * Kiểm tra xem biển số này vừa được tra cứu gần đây không (< 5s)
   */
  public isDuplicateLookup(canonicalPlate: string): boolean {
    if (!canonicalPlate) return false;
    const now = Date.now();
    const record = this.seenPlates.get(canonicalPlate);
    if (!record) return false;
    return now - record.lastLookedUpAt < SCAN_RESULT_COOLDOWN_MS;
  }

  /**
   * Đánh dấu biển số đã tra cứu để kích hoạt cooldown
   */
  public markLookup(canonicalPlate: string): void {
    if (!canonicalPlate) return;
    this.seenPlates.set(canonicalPlate, {
      plate: canonicalPlate,
      lastLookedUpAt: Date.now(),
    });
  }

  /**
   * Tạo fingerprint đơn giản từ kích thước và mẫu pixel đại diện
   */
  public generateImageFingerprint(canvas: HTMLCanvasElement): string {
    const ctx = canvas.getContext("2d");
    if (!ctx) return `${canvas.width}x${canvas.height}`;
    // Lấy mẫu 16 điểm ảnh
    const sample = ctx.getImageData(0, 0, Math.min(64, canvas.width), Math.min(64, canvas.height));
    let hash = 0;
    for (let i = 0; i < sample.data.length; i += 32) {
      hash = (hash << 5) - hash + sample.data[i];
      hash |= 0;
    }
    return `${canvas.width}x${canvas.height}_${hash}`;
  }

  /**
   * Kiểm tra xem chuỗi ảnh này có đang trong thời gian cooldown của AI API không
   */
  public shouldThrottleAiCall(fingerprint: string): boolean {
    const record = this.aiCallCache.get(fingerprint);
    if (!record) return false;
    return Date.now() - record.lastCalledAt < AI_FALLBACK_COOLDOWN_MS;
  }

  /**
   * Ghi nhận lần gọi AI
   */
  public markAiCall(fingerprint: string, resultPlate?: string): void {
    this.aiCallCache.set(fingerprint, {
      fingerprint,
      lastCalledAt: Date.now(),
      resultPlate,
    });
  }

  public reset(): void {
    this.seenPlates.clear();
    this.aiCallCache.clear();
  }
}

export const anprDeduplicator = new ANPRDeduplicator();
