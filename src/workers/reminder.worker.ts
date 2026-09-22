import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { scanAllTenantReminders } from "../services/reminder.service";

function redisConnection(url: string) {
  return new Redis(url, { maxRetriesPerRequest: null });
}

/**
 * 07:00 Asia/Ho_Chi_Minh = 00:00 UTC.
 */
export function startReminderWorker() {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn("[worker] Chưa có REDIS_URL — bỏ qua hàng đợi nhắc hạn.");
    return;
  }

  const queue = new Queue("nhac-han", { connection: redisConnection(url) });
  const worker = new Worker(
    "nhac-han",
    async () => {
      const result = await scanAllTenantReminders();
      console.info("[nhac-han] Đã gửi", result.sent, "tin /", result.sms, "SMS cho", result.tenants, "bãi");
      return result;
    },
    { connection: redisConnection(url) },
  );

  void queue.upsertJobScheduler(
    "quet-hang-ngay",
    { pattern: "0 0 * * *", tz: "UTC" },
    { name: "quet-hang-ngay", data: {} },
  );

  worker.on("failed", (job, error) => {
    console.error("[nhac-han] lỗi", job?.id, error);
  });
}
