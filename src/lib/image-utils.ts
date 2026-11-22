export async function prepareCompressedImageAndThumb(file: File): Promise<{
  originalBlob: Blob;
  thumbnailBlob: Blob;
}> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Gagal membaca file gambar.'));
      el.src = imageUrl;
    });

    // Compress original down to max 1600px if oversized while preserving quality
    const origScale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const origW = Math.max(1, Math.round(img.width * origScale));
    const origH = Math.max(1, Math.round(img.height * origScale));
    const origCanvas = document.createElement('canvas');
    origCanvas.width = origW;
    origCanvas.height = origH;
    const origCtx = origCanvas.getContext('2d');
    if (!origCtx) {
      return { originalBlob: file, thumbnailBlob: file };
    }
    origCtx.drawImage(img, 0, 0, origW, origH);

    // Create thumbnail max 360px
    const thumbScale = Math.min(1, 360 / Math.max(img.width, img.height));
    const thumbW = Math.max(1, Math.round(img.width * thumbScale));
    const thumbH = Math.max(1, Math.round(img.height * thumbScale));
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbW;
    thumbCanvas.height = thumbH;
    const thumbCtx = thumbCanvas.getContext('2d');
    if (thumbCtx) {
      thumbCtx.drawImage(img, 0, 0, thumbW, thumbH);
    }

    let originalBlob = await new Promise<Blob>((resolve) => {
      origCanvas.toBlob(
        (b) => resolve(b || file),
        file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        0.86
      );
    });

    if (originalBlob.size > 3 * 1024 * 1024) {
      originalBlob = await new Promise<Blob>((resolve) => {
        origCanvas.toBlob((b) => resolve(b || originalBlob), 'image/jpeg', 0.84);
      });
    }

    const thumbnailBlob = await new Promise<Blob>((resolve) => {
      (thumbCtx ? thumbCanvas : origCanvas).toBlob(
        (b) => resolve(b || originalBlob),
        'image/webp',
        0.78
      );
    });

    return { originalBlob, thumbnailBlob };
  } catch {
    return { originalBlob: file, thumbnailBlob: file };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
