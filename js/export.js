// export.js - Export and download functionality

/**
 * Export canvas as image download.
 * @param {HTMLCanvasElement} canvas - The full-resolution canvas
 * @param {number} seed - Current seed for filename
 * @param {boolean} transparent - Whether to export as PNG
 */
export function downloadCanvas(canvas, seed, transparent) {
  const ext = transparent ? 'png' : 'jpg';
  const mimeType = transparent ? 'image/png' : 'image/jpeg';
  const quality = transparent ? undefined : 0.92;
  const timestamp = Date.now();
  const filename = `collage_${seed}_${timestamp}.${ext}`;

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, mimeType, quality);
}
