import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "../_lib/staff-access";
import { detectImageType } from "../_lib/image-type";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Server-side proxy to Cloudinary for product images (no client uploads).
 * Only staff who manage products may use it; the file must really be a
 * png/jpeg/webp/avif (by its bytes) and at most 5 MB. There is deliberately
 * no built-in account: if Cloudinary isn't configured it says so.
 */
export async function POST(request: NextRequest) {
  const access = await requirePermission(request, "can_manage_products");
  if (!access.ok) return access.response;

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim();
  if (!cloudName || !uploadPreset) {
    return NextResponse.json({ error: "Image uploads aren't configured.", code: "UPLOAD_NOT_CONFIGURED" }, { status: 503 });
  }

  let file: Blob | null = null;
  try {
    const form = await request.formData();
    const f = form.get("file");
    // A file part, not a plain text field (checked by shape: File classes differ across runtimes).
    file = f !== null && typeof f === "object" && typeof (f as Blob).arrayBuffer === "function" ? (f as Blob) : null;
  } catch {
    return NextResponse.json({ error: "Send the image as multipart form data.", code: "INVALID_BODY" }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "No file provided", code: "FILE_REQUIRED" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Images can be at most 5 MB.", code: "FILE_TOO_LARGE" }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!detectImageType(bytes)) {
    return NextResponse.json({ error: "Only PNG, JPEG, WebP or AVIF images are allowed.", code: "UNSUPPORTED_FILE_TYPE" }, { status: 415 });
  }

  const cloudForm = new FormData();
  cloudForm.append("file", file);
  cloudForm.append("upload_preset", uploadPreset);
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  if (apiKey) cloudForm.append("api_key", apiKey);

  let res: Response;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: cloudForm });
  } catch {
    return NextResponse.json({ error: "Could not reach the image service.", code: "UPLOAD_FAILED" }, { status: 502 });
  }
  if (!res.ok) {
    // What Cloudinary said may name our account settings; keep it out of the response.
    return NextResponse.json({ error: "The image service rejected the upload.", code: "UPLOAD_FAILED" }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json({
    url: data.secure_url || data.url,
    public_id: data.public_id,
    cloudinary_public_id: data.public_id,
  });
}
