import { NextRequest } from "next/server";
import { confirmSaasByTransfer } from "@/services/billing.service";
import { confirmCollectByTransfer } from "@/services/collect.service";

function webhookAllowed(request: NextRequest) {
  const secret = process.env.SEPAY_WEBHOOK_KEY ?? process.env.PAYMENT_WEBHOOK_KEY ?? "";
  if (!secret) return process.env.NODE_ENV !== "production";
  const header =
    request.headers.get("authorization") ??
    request.headers.get("x-api-key") ??
    "";
  const query = request.nextUrl.searchParams.get("key") ?? "";
  return header === secret || header === `Apikey ${secret}` || query === secret;
}

function readAmount(body: Record<string, unknown>) {
  const raw = body.transferAmount ?? body.amount ?? body.soTien;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function readContent(body: Record<string, unknown>) {
  return String(body.content ?? body.addInfo ?? body.description ?? body.noiDung ?? "");
}

export async function POST(request: NextRequest) {
  if (!webhookAllowed(request)) {
    return Response.json({ message: "Không được phép." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const transferType = String(body.transferType ?? "in").toLowerCase();
  if (transferType && transferType !== "in") {
    return Response.json({ ok: true, skipped: true });
  }
  try {
    const collect = await confirmCollectByTransfer({
      content: readContent(body),
      amount: readAmount(body),
    });
    if (collect) {
      return Response.json({ ok: true, kind: "thu-khach" });
    }
    const result = await confirmSaasByTransfer({
      content: readContent(body),
      amount: readAmount(body),
    });
    return Response.json({ ok: true, kind: "goi", planName: result.planName });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không khớp.";
    return Response.json({ ok: false, message }, { status: 200 });
  }
}
