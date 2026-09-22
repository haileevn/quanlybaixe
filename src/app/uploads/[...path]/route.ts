import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export async function GET(
  request: Request,
  props: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await props.params;
    if (!pathSegments || pathSegments.length === 0) {
      return new Response("File not found", { status: 404 });
    }

    // Ngăn chặn Path Traversal
    for (const segment of pathSegments) {
      if (segment.includes("..") || segment.includes("/") || segment.includes("\\")) {
        return new Response("Invalid path", { status: 400 });
      }
    }

    const filePath = path.join(process.cwd(), "public", "uploads", ...pathSegments);

    // Kiểm tra file có tồn tại không
    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        return new Response("File not found", { status: 404 });
      }
    } catch {
      return new Response("File not found", { status: 404 });
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const fileBuffer = await readFile(filePath);

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[Uploads Route Error]", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
