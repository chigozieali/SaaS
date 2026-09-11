import { randomUUID } from "crypto";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { getApiContext, apiError, apiOk } from "@/lib/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export async function POST(req: Request) {
  const res = await getApiContext("employees.self");
  if ("error" in res) return res.error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError("Expected multipart form data", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return apiError("No file provided", 400);

  const mime = (file.type || "").toLowerCase();
  const ext = MIME_EXT[mime];
  if (!ext) return apiError("Only JPG, PNG, WebP or GIF images are allowed", 400);
  if (file.size > MAX_SIZE) return apiError("Image must be 5 MB or smaller", 400);

  const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");
  await mkdir(uploadDir, { recursive: true });

  const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  await writeFile(path.join(uploadDir, fileName), Buffer.from(await file.arrayBuffer()));

  return apiOk({ url: `/uploads/avatars/${fileName}` });
}