export const MAX_IMAGES = 6;
export const MAX_TOTAL_BYTES = 12 * 1024 * 1024;

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export function isImageFile(file: File): boolean {
  return IMAGE_TYPES.has(file.type.toLowerCase());
}

export function isCsvFile(file: File): boolean {
  return (
    file.type === "text/csv" ||
    file.type === "application/csv" ||
    file.name.toLowerCase().endsWith(".csv")
  );
}

export function prettyBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function safeFileName(name: string): string {
  return name
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/**
 * Downscale large photos in the browser before upload. This keeps the request
 * under serverless body limits without making receipt text unreadable.
 */
export async function prepareFile(file: File): Promise<File> {
  if (!isImageFile(file) || file.size <= 1_500_000) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 1_800;
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob) return file;

    const name = safeFileName(file.name).replace(/\.(png|webp|jpeg|jpg)$/i, ".jpg");
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
