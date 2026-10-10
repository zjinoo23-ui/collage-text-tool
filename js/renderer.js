// renderer.js - Canvas rendering engine

import { drawBackground } from './backgrounds.js';
import { computeLayout, SIZES } from './layout.js';
import { segmentText } from './segmenter.js';
import { createRng, createPositionRng } from './rng.js';
import { createColorScheme } from './palettes.js';
import { assetsReady, getTextureImages } from './assets.js';

/**
 * Render collage to a canvas at full resolution.
 * @param {object} params - All generation parameters
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @returns {object} The layout result
 */
export function renderToCanvas(params, canvas) {
  const { text, segmentMode, sizeKey, bgType, align, seed, randomAmount, scale, toggles } = params;

  const size = SIZES[sizeKey];
  canvas.width = size.w;
  canvas.height = size.h;

  const ctx = canvas.getContext('2d');

  // Draw background (seed for deterministic noise)
  drawBackground(ctx, size.w, size.h, bgType, seed);

  // Segment text
  const units = segmentText(text, segmentMode);
  if (units.length === 0) return null;

  // Create color scheme from global seed
  const globalRng = createRng(seed);
  const driftAmount = (randomAmount / 100) * 0.5;
  const colorScheme = createColorScheme(globalRng, driftAmount);

  // Compute layout
  const layout = computeLayout({
    units,
    sizeKey,
    bgType,
    align,
    seed,
    randomAmount,
    scale,
    toggles,
    colorScheme,
    ctx
  });

  if (!layout) return null;

  // Draw each paper element
  for (const el of layout.elements) {
    ctx.save();
    ctx.translate(el.x, el.y);
    ctx.rotate(el.rotation);

    // Offset so paper is centered at origin
    const offX = -el.paper.bounds.w / 2;
    const offY = -el.paper.bounds.h / 2;
    ctx.translate(offX, offY);

    // Draw paper drop shadow (贴纸投影) — drawn under the paper fill
    const shadowFs = el.fontSize || 40;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
    ctx.shadowBlur = Math.max(3, shadowFs * 0.15);
    ctx.shadowOffsetX = Math.max(1, shadowFs * 0.02);
    ctx.shadowOffsetY = Math.max(1, shadowFs * 0.04);
    ctx.fillStyle = '#000';
    if (el.paper.mask) {
      ctx.drawImage(el.paper.mask, 0, 0);
    } else {
      ctx.fill(el.paper.path);
    }
    ctx.restore();

    // Draw paper fill — 底色 + 纹理叠加（正片叠底 Multiply）
    // 纹理随机取一块区域（基于 element seed），避免每个纸片纹理位置相同
    const texImg = assetsReady() ? getTextureImages()[el.textureIdx] : null;
    const bw = el.paper.bounds.w;
    const bh = el.paper.bounds.h;

    // 随机偏移：基于 element index 派生，让每个纸片从纹理图不同位置取样
    const texW = texImg ? (texImg.naturalWidth || 100) : 100;
    const texH = texImg ? (texImg.naturalHeight || 100) : 100;
    const ox = -(((el.index * 73 + 41) % 1000) / 1000 * texW);
    const oy = -(((el.index * 97 + 29) % 1000) / 1000 * texH);

    if (el.paper.mask) {
      // glyphCutout: 底色 + 纹理叠加，裁剪到字形轮廓
      const tmp = document.createElement('canvas');
      tmp.width = bw;
      tmp.height = bh;
      const tctx = tmp.getContext('2d');
      // 第 1 层：底色
      tctx.fillStyle = el.fillColor;
      tctx.fillRect(0, 0, bw, bh);
      // 第 2 层：纹理（正片叠底）
      if (texImg) {
        tctx.globalCompositeOperation = 'multiply';
        const pattern = tctx.createPattern(texImg, 'repeat');
        tctx.fillStyle = pattern;
        tctx.translate(ox, oy);
        tctx.fillRect(-ox, -oy, bw + Math.abs(ox) + 100, bh + Math.abs(oy) + 100);
        tctx.globalCompositeOperation = 'source-over';
      }
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.globalCompositeOperation = 'destination-in';
      tctx.drawImage(el.paper.mask, 0, 0);
      ctx.drawImage(tmp, 0, 0);
    } else if (texImg) {
      // 普通形状：底色 + 纹理叠加
      ctx.save();
      ctx.clip(el.paper.path);
      // 第 1 层：底色
      ctx.fillStyle = el.fillColor;
      ctx.fillRect(0, 0, bw, bh);
      // 第 2 层：纹理（正片叠底）
      ctx.globalCompositeOperation = 'multiply';
      const pattern = ctx.createPattern(texImg, 'repeat');
      ctx.fillStyle = pattern;
      ctx.translate(ox, oy);
      ctx.fillRect(-ox, -oy, bw + Math.abs(ox) + 100, bh + Math.abs(oy) + 100);
      ctx.restore();
    } else {
      // 无纹理：纯底色
      ctx.fillStyle = el.fillColor;
      ctx.fill(el.paper.path);
    }

    // Draw text with stroke (描边) — layered approach
    ctx.font = el.fontCss;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 用 bounds 中心定位文字，与 safeBox 计算一致
    const baseX = el.paper.bounds.w / 2;
    const baseY = el.paper.bounds.h / 2;
    const isGlyphCutout = el.paper.type === 'glyphCutout';
    // Only glyphCutout skips offset (text pre-centered in mask).
    // All others (including punctuation) subtract ox/oy to center glyph in paper.
    // Punctuation's natural position comes from the element position offset in layout.js.
    const textX = baseX - (isGlyphCutout ? 0 : (el.glyphOx || 0));
    const textY = baseY - (isGlyphCutout ? 0 : (el.glyphOy || 0));

    // Layer 2: text stroke outline (only if strokeW > 0, uses palette stroke color)
    if (el.strokeW > 0) {
      ctx.strokeStyle = el.strokeColor;
      ctx.lineWidth = el.strokeW;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(el.text, textX, textY);
    }

    // Layer 3: text fill on top (uses palette text color)
    ctx.fillStyle = el.textColor;
    ctx.fillText(el.text, textX, textY);

    ctx.restore();
  }

  return layout;
}

/**
 * Render a preview at reduced scale for fast display.
 */
export function renderPreview(params, canvas, maxDisplaySize) {
  const size = SIZES[params.sizeKey];
  const aspect = size.w / size.h;

  // Scale down for preview
  let displayW = maxDisplaySize;
  let displayH = maxDisplaySize / aspect;
  if (displayH > maxDisplaySize * 1.3) {
    displayH = maxDisplaySize * 1.3;
    displayW = displayH * aspect;
  }

  const scale = displayW / size.w;
  canvas.width = Math.round(displayW);
  canvas.height = Math.round(displayH);

  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Reuse full render logic but on scaled context
  renderToCanvas(params, { width: size.w, height: size.h, getContext: () => ctx });

  return { displayW, displayH };
}
