import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided", code: "FILE_REQUIRED" },
        { status: 400 }
      );
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "gts";
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "gtsProducts";
    const apiKey = process.env.CLOUDINARY_API_KEY || "438796324785531";

    const cldFormData = new FormData();
    cldFormData.append("file", file);
    cldFormData.append("upload_preset", uploadPreset);
    cldFormData.append("api_key", apiKey);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: cldFormData,
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.error?.message || "Failed to upload to Cloudinary", details: err },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      url: data.secure_url || data.url,
      public_id: data.public_id,
      cloudinary_public_id: data.public_id,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
