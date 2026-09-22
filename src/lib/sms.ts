import { toSmsNumber } from "@/lib/phone";

export type SmsSendResult = {
  delivered: boolean;
  to: string;
  provider: string;
  error?: string;
};

function providerName() {
  return (process.env.SMS_PROVIDER ?? "log").trim().toLowerCase();
}

export function isSmsConfigured() {
  const provider = providerName();
  if (provider === "speedsms") return Boolean(process.env.SMS_ACCESS_TOKEN);
  if (provider === "esms") return Boolean(process.env.SMS_API_KEY && process.env.SMS_SECRET_KEY);
  if (provider === "twilio") {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM,
    );
  }
  return false;
}

async function postJson(url: string, body: unknown, headers: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: response.ok, status: response.status, json, text };
}

async function sendSpeedSms(to: string, content: string): Promise<SmsSendResult> {
  const token = process.env.SMS_ACCESS_TOKEN ?? "";
  const auth = Buffer.from(`${token}:`).toString("base64");
  const result = await postJson(
    "https://api.speedsms.vn/index.php/sms/send",
    {
      to: [to],
      content,
      sms_type: Number(process.env.SMS_TYPE ?? "2"),
      sender: process.env.SMS_BRAND ?? "",
    },
    { Authorization: `Basic ${auth}` },
  );
  const data = result.json as { status?: string | number; code?: string; message?: string } | null;
  const code = String(data?.status ?? data?.code ?? "");
  if (code === "00" || code === "0") {
    return { delivered: true, to, provider: "speedsms" };
  }
  return {
    delivered: false,
    to,
    provider: "speedsms",
    error: data?.message || `Nhà mạng trả về mã ${code || result.status}.`,
  };
}

async function sendEsms(to: string, content: string): Promise<SmsSendResult> {
  const local = to.startsWith("84") ? `0${to.slice(2)}` : to;
  const result = await postJson(
    "https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post",
    {
      ApiKey: process.env.SMS_API_KEY,
      SecretKey: process.env.SMS_SECRET_KEY,
      Phone: local,
      Content: content,
      SmsType: process.env.SMS_TYPE ?? "2",
      Brandname: process.env.SMS_BRAND ?? "",
      Sandbox: process.env.SMS_SANDBOX === "1" ? "1" : "0",
    },
    {},
  );
  const data = result.json as { CodeResult?: string; ErrorMessage?: string; SMSID?: string } | null;
  if (data?.CodeResult === "100") {
    return { delivered: true, to, provider: "esms" };
  }
  return {
    delivered: false,
    to,
    provider: "esms",
    error: data?.ErrorMessage || `Nhà mạng trả về mã ${data?.CodeResult ?? result.status}.`,
  };
}

async function sendTwilio(to: string, content: string): Promise<SmsSendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID ?? "";
  const token = process.env.TWILIO_AUTH_TOKEN ?? "";
  const from = process.env.TWILIO_FROM ?? "";
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const body = new URLSearchParams({
    To: `+${to}`,
    From: from,
    Body: content,
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = (await response.json()) as { sid?: string; message?: string; error_message?: string };
  if (response.ok && data.sid) {
    return { delivered: true, to, provider: "twilio" };
  }
  return {
    delivered: false,
    to,
    provider: "twilio",
    error: data.error_message || data.message || `Twilio lỗi ${response.status}.`,
  };
}

export async function sendSms(input: { to: string; body: string }): Promise<SmsSendResult> {
  const to = toSmsNumber(input.to);
  if (!to) {
    return { delivered: false, to: input.to, provider: providerName(), error: "Số điện thoại chưa đúng." };
  }
  const body = input.body.trim();
  if (!body) {
    return { delivered: false, to, provider: providerName(), error: "Nhập nội dung tin nhắn." };
  }

  const provider = providerName();
  if (provider === "log" || provider === "dev" || !isSmsConfigured()) {
    console.info("[sms:dev]", to, body);
    return { delivered: false, to, provider: "log" };
  }

  try {
    if (provider === "speedsms") return await sendSpeedSms(to, body);
    if (provider === "esms") return await sendEsms(to, body);
    if (provider === "twilio") return await sendTwilio(to, body);
    console.info("[sms:unknown-provider]", provider, to, body);
    return { delivered: false, to, provider, error: "Chưa hỗ trợ nhà mạng này." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không gửi được tin.";
    console.error("[sms]", provider, message);
    return { delivered: false, to, provider, error: "Không gửi được tin. Thử lại sau." };
  }
}
