/**
 * Client-side image compression for screenshot slots.
 * Converts clipboard images or dropped files to WebP (max 1920px, 85% quality)
 * to keep SQLite attachments small (~150KB per screenshot instead of 6MB).
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export async function compressImageToWebP(
  file: File | Blob,
  options: CompressOptions = {},
): Promise<File> {
  const { maxWidth = 1920, maxHeight = 1080, quality = 0.85 } = options;

  if (typeof window === "undefined" || typeof document === "undefined") {
    return file instanceof File
      ? file
      : new File([file], "screenshot.webp", { type: "image/webp" });
  }

  // If already WebP and smaller than 250KB, return as-is
  if (file.type === "image/webp" && file.size < 250 * 1024 && file instanceof File) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(
            file instanceof File
              ? file
              : new File([file], "screenshot.webp", { type: file.type || "image/webp" }),
          );
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(
                file instanceof File
                  ? file
                  : new File([file], "screenshot.webp", { type: file.type || "image/webp" }),
              );
              return;
            }
            const rawName = file instanceof File && file.name ? file.name.trim() : "";
            const baseName = rawName.length > 0 ? rawName.replace(/\.[^/.]+$/, "") : "screenshot";
            const filename = `${baseName || "screenshot"}.webp`;
            const compressed = new File([blob], filename, { type: "image/webp" });
            resolve(compressed);
          },
          "image/webp",
          quality,
        );
      } catch {
        resolve(
          file instanceof File
            ? file
            : new File([file], "screenshot.webp", { type: file.type || "image/webp" }),
        );
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(
        file instanceof File
          ? file
          : new File([file], "screenshot.webp", { type: file.type || "image/webp" }),
      );
    };

    img.src = url;
  });
}
