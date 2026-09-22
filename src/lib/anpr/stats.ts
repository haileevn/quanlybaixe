import type { ANPRTelemetry } from "./types";

const STORAGE_KEY = "sobaixe_anpr_telemetry_v1";

class ANPRTelemetryTracker {
  private stats: ANPRTelemetry = {
    totalScans: 0,
    localSuccess: 0,
    aiFallback: 0,
    aiSuccess: 0,
    failed: 0,
    apiAvoided: 0,
  };

  constructor() {
    this.load();
  }

  private load(): void {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.stats = { ...this.stats, ...JSON.parse(raw) };
      }
    } catch {
      // Bỏ qua lỗi storage
    }
  }

  private save(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
    } catch {
      // Bỏ qua lỗi storage
    }
  }

  public getStats(): ANPRTelemetry {
    return { ...this.stats };
  }

  public recordScan(event: {
    source: "local" | "ai";
    success: boolean;
  }): void {
    this.stats.totalScans += 1;

    if (event.source === "local" && event.success) {
      this.stats.localSuccess += 1;
      this.stats.apiAvoided += 1; // 1 lượt Local thành công = Tiết kiệm 1 lần gọi AI API!
    } else if (event.source === "ai") {
      this.stats.aiFallback += 1;
      if (event.success) {
        this.stats.aiSuccess += 1;
      } else {
        this.stats.failed += 1;
      }
    } else if (!event.success) {
      this.stats.failed += 1;
    }

    this.save();
  }

  public reset(): void {
    this.stats = {
      totalScans: 0,
      localSuccess: 0,
      aiFallback: 0,
      aiSuccess: 0,
      failed: 0,
      apiAvoided: 0,
    };
    this.save();
  }
}

export const anprStats = new ANPRTelemetryTracker();
