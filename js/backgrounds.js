// backgrounds.js - Background texture generation

const BG_TYPES = ['white', 'notebook', 'dotgrid', 'kraft', 'transparent'];

export function getBgTypes() {
  return BG_TYPES;
}

// Deterministic pseudo-random for reproducible noise (seed-based)
function hash2(x, y, seed) {
  let h = seed * 374761393 + x * 668265263 + y * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Draw background on canvas context
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {string} type - 'white'|'notebook'|'dotgrid'|'kraft'|'transparent'
 * @param {number} seed - Seed for deterministic noise
 */
export function drawBackground(ctx, width, height, type, seed = 0) {
  ctx.save();

  switch (type) {
    case 'white':
      ctx.fillStyle = '#fefefe';
      ctx.fillRect(0, 0, width, height);
      drawNoise(ctx, width, height, 0.015, '#000', seed);
      break;

    case 'notebook':
      ctx.fillStyle = '#fdfcf7';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(180, 200, 220, 0.5)';
      ctx.lineWidth = Math.max(1, width * 0.001);
      const lineGap = height * 0.045;
      ctx.beginPath();
      for (let y = lineGap; y < height; y += lineGap) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(220, 120, 120, 0.4)';
      ctx.lineWidth = Math.max(1, width * 0.0015);
      ctx.beginPath();
      ctx.moveTo(width * 0.08, 0);
      ctx.lineTo(width * 0.08, height);
      ctx.stroke();
      break;

    case 'dotgrid':
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(150, 150, 150, 0.35)';
      const dotGap = width * 0.035;
      const dotSize = Math.max(1, width * 0.002);
      for (let x = dotGap; x < width; x += dotGap) {
        for (let y = dotGap; y < height; y += dotGap) {
          ctx.beginPath();
          ctx.arc(x, y, dotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;

    case 'kraft':
      ctx.fillStyle = '#c8a87c';
      ctx.fillRect(0, 0, width, height);
      drawNoise(ctx, width, height, 0.06, '#8B7355', seed);
      drawNoise(ctx, width, height, 0.04, '#a08060', seed + 1);
      break;

    case 'transparent':
      ctx.clearRect(0, 0, width, height);
      break;
  }

  ctx.restore();
}

function drawNoise(ctx, width, height, density, color, seed) {
  const count = Math.floor(width * height * density * 0.001);
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = hash2(i, 0, seed) * width;
    const y = hash2(i, 1, seed) * height;
    const size = hash2(i, 2, seed) * 2 + 0.5;
    ctx.globalAlpha = hash2(i, 3, seed) * 0.15;
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = 1;
}
