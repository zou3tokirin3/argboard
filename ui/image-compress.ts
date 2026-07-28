/** Browser-only image resize / encode for card screenshots. */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;
const WEBP_QUALITY = 0.8;

/** Resize long edge and encode as WebP (fallback JPEG). */
export async function compressImage(
  source: Blob,
  maxEdge = MAX_EDGE,
): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像を圧縮できませんでした");
    ctx.drawImage(bitmap, 0, 0, w, h);
    const webp = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
    if (webp && webp.size > 0) return webp;
    const jpeg = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
    if (jpeg && jpeg.size > 0) return jpeg;
    throw new Error("画像を圧縮できませんでした");
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}
