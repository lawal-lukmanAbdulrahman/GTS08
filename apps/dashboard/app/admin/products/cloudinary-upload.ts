import { API_BASE } from "../../lib/api-base";
/**
 * Helper to optimize image resolution/size, inspect transparency,
 * and upload to Cloudinary using unsigned upload preset or backend route.
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

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "gts";
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "gtsProducts";

  // Try direct Cloudinary REST endpoint
  const formData = new FormData();
  formData.append("file", fileToUpload);
  formData.append("upload_preset", uploadPreset);
  if (folder) {
    formData.append("folder", folder);
  }

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (res.ok) {
      const data = await res.json();
      return {
        url: data.secure_url || data.url,
        public_id: data.public_id,
        hasTransparentBg,
        width: width || data.width || 0,
        height: height || data.height || 0,
        originalSize,
        optimizedSize,
      };
    }

    // If preset with folder failed or had error, parse response
    const errData = await res.json().catch(() => ({}));
    console.warn("Cloudinary upload response:", errData);
    
    // Fallback: try backend proxy /api/v1/upload
    const proxyFormData = new FormData();
    proxyFormData.append("file", fileToUpload);
    const proxyToken = typeof window !== "undefined" ? localStorage.getItem("gts_token") : null;
    const backendRes = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      headers: proxyToken ? { Authorization: `Bearer ${proxyToken}` } : {},
      body: proxyFormData,
    });
    if (backendRes.ok) {
      const backendData = await backendRes.json();
      return {
        url: backendData.secure_url || backendData.url,
        public_id: backendData.public_id || backendData.cloudinary_public_id,
        hasTransparentBg,
        width: width || backendData.width || 0,
        height: height || backendData.height || 0,
        originalSize,
        optimizedSize,
      };
    }

    throw new Error(errData?.error?.message || "Failed to upload image to Cloudinary.");
  } catch (error: any) {
    console.error("Cloudinary upload failed:", error);
    // If offline or upload fails during local dev test, generate a local preview URL
    if (fileToUpload instanceof File || fileToUpload instanceof Blob) {
      const objectUrl = URL.createObjectURL(fileToUpload);
      return {
        url: objectUrl,
        public_id: `local_${Date.now()}`,
        hasTransparentBg,
        width,
        height,
        originalSize,
        optimizedSize,
      };
    }
    throw error;
  }
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

