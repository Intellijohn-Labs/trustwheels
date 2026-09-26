/** Downscale and re-encode a photo in the browser before it is stored or uploaded. */
export async function compressImage(file: File, maxSide = 1280, quality = 0.72): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024; // 8 MB

/** Read a document (photo or PDF) as a data URL. Photos are compressed; PDFs are read as-is. */
export async function readDocumentFile(file: File): Promise<string> {
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("File is too large (max 8 MB)");
  if (file.type === "application/pdf") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Couldn't read that file"));
      reader.readAsDataURL(file);
    });
  }
  if (file.type.startsWith("image/")) return compressImage(file, 1600, 0.8);
  throw new Error("Only PDF or image files are allowed");
}
