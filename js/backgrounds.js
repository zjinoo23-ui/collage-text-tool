// backgrounds.js - Background texture generation
// 支持图片背景：把 PNG 放到 assets/backgrounds/ 下，命名与类型对应。
// 有图片就用图片（cover 模式铺满+裁切），没有就回退到代码绘制。

const BG_TYPES = ['white', 'notebook', 'dotgrid', 'kraft', 'transparent'];

// 背景图配置：type → 图片路径（transparent 不需要图片）
const BG_IMAGE_CONFIG = {
  white:     'assets/backgrounds/white.png',
  notebook:  'assets/backgrounds/notebook.png',
  dotgrid:   'assets/backgrounds/dotgrid.png',
  kraft:     'assets/backgrounds/kraft.png',
};

// 已加载的背景图缓存：type → HTMLImageElement | null
const bgImageCache = {};

export function getBgTypes() {
  return BG_TYPES;
}

/**
 * 预加载所有背景图。加载失败的类型回退到代码绘制。
 * 返回 Promise，resolve 后所有图片状态确定。
 */
export function preloadBackgrounds() {
  const entries = Object.entries(BG_IMAGE_CONFIG);
  return Promise.all(entries.map(([type, path]) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { bgImageCache[type] = img; resolve(); };
      img.onerror = () => { bgImageCache[type] = null; resolve(); };
      img.src = path;
    });
  })).then(() => {
    const loaded = Object.values(bgImageCache).filter(Boolean).length;
    console.log(`[backgrounds] loaded ${loaded}/${entries.length} background images`);
  });
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

  // 优先用图片背景（cover 模式：保持比例缩放铺满 + 居中裁切）
  const bgImg = bgImageCache[type];
  if (bgImg) {
    drawImageCover(ctx, bgImg, 0, 0, width, height);
    ctx.restore();
    return;
  }

  // 没有图片，回退到代码绘制
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

/**
 * cover 模式绘制图片：保持比例缩放铺满目标区域，居中裁掉多余部分。
 * 类似 CSS background-size: cover。
 */
function drawImageCover(ctx, img, x, y, w, h) {
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;
  if (!imgW || !imgH) return;
  const scale = Math.max(w / imgW, h / imgH);
  const dw = imgW * scale;
  const dh = imgH * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}
