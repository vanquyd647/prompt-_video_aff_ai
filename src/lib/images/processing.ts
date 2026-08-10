import type { StoredImage, UploadedImage } from "@/types";
import { createId } from "@/lib/utils/id";

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export async function createUploadedImage(file: File): Promise<UploadedImage> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new Error("Chỉ hỗ trợ JPEG, PNG hoặc WebP.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Ảnh vượt quá giới hạn 15MB.");
  const previewUrl = URL.createObjectURL(file);
  const dimensions = await new Promise<{ width?: number; height?: number }>((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({});
    image.src = previewUrl;
  });
  return { id: createId(), file, previewUrl, ...dimensions };
}

export const toStoredImage = (image: UploadedImage): StoredImage => ({
  id: image.id, name: image.file.name, type: image.file.type, size: image.file.size,
  lastModified: image.file.lastModified, width: image.width, height: image.height, blob: image.file,
});

export const fromStoredImage = (image: StoredImage): UploadedImage => {
  const file = new File([image.blob], image.name, { type: image.type, lastModified: image.lastModified });
  return { id: image.id, file, width: image.width, height: image.height, previewUrl: URL.createObjectURL(file) };
};

export const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
