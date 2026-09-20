import { API_BASE, getToken } from "../../lib/session";
/**
 * Helper to optimize image resolution/size, inspect transparency,
 * and upload through our authenticated `/api/v1/upload` route (the browser never talks to Cloudinary).
 */

export interface ImageOptimizationResult {
  file: Blob | File;
  hasTransparentBg: boolean;
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
}

/**
 * Optimizes image resolution (max 1200x1200px), compresses for rapid upload speeds,
 * and analyzes alpha channels to verify if it has a transparent background.
 */
export async function optimizeAndInspectImage(
  file: File,
  maxDimension: number = 1200
): Promise<ImageOptimizationResult> {
  return new Promise((resolve) => {
    // If not in browser or not an image file
    if (typeof window === "undefined" || !file.type?.startsWith("image/")) {
      return resolve({
        file,
        hasTransparentBg: false,
        width: 0,
        height: 0,
        originalSize: file.size,
        optimizedSize: file.size,
      });
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // Scale to stable resolution bounds while maintaining aspect ratio
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (!ctx) {
        return resolve({
          file,
          hasTransparentBg: false,
          width: img.width,
          height: img.height,
          originalSize: file.size,
          optimizedSize: file.size,
        });
      }

      // Draw the resized image
      ctx.drawImage(img, 0, 0, width, height);

      // Check alpha channel for transparency
      let hasTransparency = false;
      try {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        // Sample pixel alpha values (data[i + 3])
        for (let i = 3; i < data.length; i += 16) {
          const alpha = data[i];
          if (alpha !== undefined && alpha < 240) {
            hasTransparency = true;
            break;
          }
        }
      } catch (e) {
        console.warn("Could not inspect image transparency:", e);
      }

      // If transparent, use PNG to preserve clear alpha channel.
      // If opaque, use WebP with 0.88 quality for dramatic compression & crispness.
      const outputFormat = hasTransparency ? "image/png" : "image/webp";
      const quality = hasTransparency ? undefined : 0.88;

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return resolve({
              file,
              hasTransparentBg: hasTransparency,
              width,
              height,
              originalSize: file.size,
              optimizedSize: file.size,
            });
          }

          resolve({
            file: blob,
            hasTransparentBg: hasTransparency,
            width,
            height,
            originalSize: file.size,
            optimizedSize: blob.size,
          });
        },
        outputFormat,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        file,
        hasTransparentBg: false,
        width: 0,
        height: 0,
        originalSize: file.size,
        optimizedSize: file.size,
      });
    };

    img.src = url;
  });
}

export async function uploadToCloudinary(
  file: File | Blob,
  folder: string = "gts/products"
): Promise<{
  url: string;
  public_id: string;
  hasTransparentBg: boolean;
  width: number;
  height: number;
  originalSize?: number;
  optimizedSize?: number;
}> {
  let fileToUpload: File | Blob = file;
  let hasTransparentBg = false;
  let width = 0;
  let height = 0;
  let originalSize = file.size;
  let optimizedSize = file.size;

  // Auto-optimize and check transparency if it's a File
  if (typeof window !== "undefined" && file instanceof File && file.type.startsWith("image/")) {
    try {
      const opt = await optimizeAndInspectImage(file, 1200);
      fileToUpload = opt.file;
      hasTransparentBg = opt.hasTransparentBg;
      width = opt.width;
      height = opt.height;
      originalSize = opt.originalSize;
      optimizedSize = opt.optimizedSize;
    } catch (e) {
      console.warn("Client optimization skipped:", e);
    }
  }

  const form = new FormData();
  form.append("file", fileToUpload);
  if (folder) form.append("folder", folder);
  const token = getToken();

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }

  const body = (await res.json().catch(() => null)) as { url?: string; secure_url?: string; public_id?: string; cloudinary_public_id?: string; width?: number; height?: number; error?: string } | null;
  if (!res.ok) throw new Error(body?.error || `Image upload failed (${res.status}).`);

  // A failed upload must never turn into a saved local (blob:) URL that only this browser can see.
  const url = body?.url || body?.secure_url;
  const publicId = body?.public_id || body?.cloudinary_public_id;
  if (!url || !publicId) throw new Error("The server returned no image URL. Please try again.");

  return {
    url,
    public_id: publicId,
    hasTransparentBg,
    width: width || body?.width || 0,
    height: height || body?.height || 0,
    originalSize,
    optimizedSize,
  };
}

/**
 * Optimizes brand logo down to a compact 300px icon, preserving crisp alpha channels
 * and compressing file size down to < 20-30 KB.
 */
export async function uploadBrandLogo(
  file: File
): Promise<{
  url: string;
  public_id: string;
  hasTransparentBg: boolean;
  width: number;
  height: number;
  originalSize?: number;
  optimizedSize?: number;
}> {
  let fileToUpload: File | Blob = file;
  let hasTransparentBg = true;
  let width = 0;
  let height = 0;
  let originalSize = file.size;
  let optimizedSize = file.size;

  if (typeof window !== "undefined" && file.type?.startsWith("image/")) {
    try {
      const opt = await optimizeAndInspectImage(file, 320);
      fileToUpload = opt.file;
      hasTransparentBg = opt.hasTransparentBg;
      width = opt.width;
      height = opt.height;
      originalSize = opt.originalSize;
      optimizedSize = opt.optimizedSize;
    } catch (e) {
      console.warn("Logo compression error:", e);
    }
  }

  return uploadToCloudinary(fileToUpload, "gts/brands");
}

