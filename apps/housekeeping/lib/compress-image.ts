// Client-side image compression for issue-report evidence photos.
//
// Why: phone cameras shoot 12–48 MP JPEGs that are 5–10 MB. Vercel rejects
// request bodies > 4.5 MB at the edge, so even our 2 MB API guard is too late.
// Compress before submit: 1600px max dimension at JPEG 0.8 typically lands
// in the 200–500 KB range with no visible quality loss for evidence photos.

const DEFAULT_MAX_DIM = 1600;
const DEFAULT_QUALITY = 0.8;

export async function compressImage(
  file: File,
  opts: { maxDimension?: number; quality?: number } = {},
): Promise<File> {
  const maxDim = opts.maxDimension ?? DEFAULT_MAX_DIM;
  const quality = opts.quality ?? DEFAULT_QUALITY;

  // Skip non-image types and tiny files — compression overhead isn't worth it.
  if (!file.type.startsWith('image/')) return file;
  if (file.size < 512 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
    });
    if (!blob) return file;

    // Preserve original name but force .jpg extension.
    const base = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch (err) {
    // Anything goes wrong → ship the original. The 2 MB server cap will catch
    // the worst case; the dashboard surface will show a clear error.
    console.warn('Image compression failed, sending original:', err);
    return file;
  }
}
