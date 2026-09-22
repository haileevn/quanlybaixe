import { startReminderWorker } from "./reminder.worker";

try {
  process.loadEnvFile();
} catch {
  // .env đã được nạp sẵn (PM2 / systemd) thì không cần file.
}

startReminderWorker();
console.info("Worker nhắc hạn đang chạy.");
