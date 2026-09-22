import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/lib/auth";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) {
    return Response.json({ message: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
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
  const dir = path.join(process.cwd(), "public", "uploads", tenantId);
  await mkdir(dir, { recursive: true });
  const filename = `${crypto.randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), bytes);
  return Response.json({ url: `/uploads/${tenantId}/${filename}` });
}
