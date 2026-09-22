import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/lib/auth";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

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

  const rawExt = path.extname(file.name || "").toLowerCase();
  const isValidMime = ALLOWED_MIME.has(file.type);
  const isValidExt = EXT_TO_MIME[rawExt] !== undefined;

  if (!isValidMime && !isValidExt) {
    return Response.json({ message: "Chỉ nhận ảnh JPG, PNG hoặc WEBP." }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ message: "Ảnh tối đa 10MB." }, { status: 400 });
  }

  let ext = "jpg";
  if (file.type === "image/png" || rawExt === ".png") ext = "png";
  else if (file.type === "image/webp" || rawExt === ".webp") ext = "webp";
  else if (file.type === "image/gif" || rawExt === ".gif") ext = "gif";

  const dir = path.join(process.cwd(), "public", "uploads", tenantId);
  await mkdir(dir, { recursive: true });
  const filename = `${crypto.randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), bytes);
  return Response.json({ url: `/uploads/${tenantId}/${filename}` });
}
