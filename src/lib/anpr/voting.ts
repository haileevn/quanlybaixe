import type { VotingCandidate } from "./types";
import { canonicalPlate } from "./normalize";

export class MultiFrameVoting {
  private windowSize: number;
  private history: { plate: string; confidence: number; timestamp: number }[] = [];

  constructor(windowSize = 5) {
    this.windowSize = windowSize;
  }

  public push(plate: string, confidence: number): VotingCandidate | null {
    const clean = canonicalPlate(plate);
    if (!clean) return null;

    const now = Date.now();
    this.history.push({ plate: clean, confidence, timestamp: now });

    if (this.history.length > this.windowSize) {
      this.history.shift();
    }

    // Đếm số phiếu cho từng biển số
    const counts: Record<string, { count: number; confSum: number; firstSeen: number; lastSeen: number }> = {};
    for (const item of this.history) {
      if (!counts[item.plate]) {
        counts[item.plate] = { count: 0, confSum: 0, firstSeen: item.timestamp, lastSeen: item.timestamp };
      }
      counts[item.plate].count += 1;
      counts[item.plate].confSum += item.confidence;
      counts[item.plate].lastSeen = item.timestamp;
    }

    let winnerPlate = clean;
    let maxCount = 0;
    let avgConf = confidence;
    let firstSeen = now;
    let lastSeen = now;

    for (const [p, stat] of Object.entries(counts)) {
      if (stat.count > maxCount) {
        maxCount = stat.count;
        winnerPlate = p;
        avgConf = stat.confSum / stat.count;
        firstSeen = stat.firstSeen;
        lastSeen = stat.lastSeen;
      }
    }

    const totalVotes = this.history.length;
    const consensusRatio = totalVotes > 0 ? maxCount / totalVotes : 0;

    return {
      plate: winnerPlate,
      count: maxCount,
      totalVotes,
      consensusRatio: Math.round(consensusRatio * 100) / 100,
      lastConfidence: Math.round(avgConf * 100) / 100,
      firstSeenAt: firstSeen,
      lastSeenAt: lastSeen,
    };
  }

  public reset(): void {
    this.history = [];
  }
}
