import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { sendSms } from "@/lib/sms";
import type { NotificationChannel, NotificationPayload } from "@/lib/notifications/channel";

export class InAppChannel implements NotificationChannel {
  id = "in_app" as const;

  async send(payload: NotificationPayload) {
    await prisma.notificationLog.create({
      data: {
        tenantId: payload.tenantId,
        channel: this.id,
        toAddress: payload.to,
        subject: payload.title,
        body: payload.body,
        status: "SENT",
      },
    });
    return { delivered: true };
  }
}

export class EmailChannel implements NotificationChannel {
  id = "email" as const;

  async send(payload: NotificationPayload) {
    const result = await sendMail({
      to: payload.to,
      subject: payload.title,
      text: payload.body,
    });
    await prisma.notificationLog.create({
      data: {
        tenantId: payload.tenantId,
        channel: this.id,
        toAddress: payload.to,
        subject: payload.title,
        body: payload.body,
        status: result.delivered ? "SENT" : "LOGGED",
      },
    });
    return { delivered: result.delivered };
  }
}

/** Chừa sẵn để gắn Zalo ZNS ở Phase sau — chưa gửi thật. */
export class ZaloZnsChannel implements NotificationChannel {
  id = "zalo_zns" as const;

  async send(payload: NotificationPayload) {
    void payload;
    return { delivered: false };
  }
}

export class SmsChannel implements NotificationChannel {
  id = "sms" as const;

  async send(payload: NotificationPayload) {
    const result = await sendSms({ to: payload.to, body: payload.body });
    await prisma.notificationLog.create({
      data: {
        tenantId: payload.tenantId,
        channel: this.id,
        toAddress: result.to,
        subject: payload.title,
        body: payload.body,
        status: result.delivered ? "SENT" : result.error ? "FAILED" : "LOGGED",
        error: result.error ?? null,
      },
    });
    return { delivered: result.delivered, error: result.error };
  }
}

export const notificationChannels: NotificationChannel[] = [
  new InAppChannel(),
  new EmailChannel(),
  new ZaloZnsChannel(),
  new SmsChannel(),
];
