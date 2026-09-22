export type NotificationPayload = {
  to: string;
  title: string;
  body: string;
  tenantId: string;
};

export interface NotificationChannel {
  id: "in_app" | "email" | "zalo_zns" | "sms";
  send(payload: NotificationPayload): Promise<{ delivered: boolean; error?: string }>;
}
