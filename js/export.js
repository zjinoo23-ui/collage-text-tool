// export.js - Export and download functionality

/**
 * Crop a canvas to its non-transparent content bounding box.
 * Used for transparent PNG export so the output matches the actual image,
 * regardless of the selected canvas aspect ratio.
 * @param {HTMLCanvasElement} sourceCanvas
 * @returns {HTMLCanvasElement}
 */
export function cropToContent(sourceCanvas) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  if (!w || !h) return sourceCanvas;

  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, w, h).data;

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      if (data[row + x * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return sourceCanvas; // 内容为空时保持原样

  // 留 2px 透明边距，防止抗锯齿/投影被裁切
  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d').drawImage(sourceCanvas, -minX, -minY);
  return out;
}
