import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const file = form.get("file");
  const intent = await prisma.collectIntent.findFirst({
    where: { publicToken: token, deletedAt: null, status: { in: ["PENDING", "PROOF"] } },
  });
  if (!intent) {
    return Response.json({ message: "Không tìm thấy khoản thanh toán." }, { status: 404 });
  }
  if (!(file instanceof File)) {
    return Response.json({ message: "Chưa chọn ảnh." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return Response.json({ message: "Chỉ nhận ảnh JPG, PNG hoặc WEBP." }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return Response.json({ message: "Ảnh tối đa 5MB." }, { status: 400 });
  }
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const dir = path.join(process.cwd(), "public", "uploads", "chung-tu");
  await mkdir(dir, { recursive: true });
  const filename = `${token}.${ext}`;
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  const url = `/uploads/chung-tu/${filename}`;
  await prisma.collectIntent.update({
    where: { id: intent.id },
    data: { proofImageUrl: url, status: "PROOF" },
  });
  return Response.json({ url });
}
