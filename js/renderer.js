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

    // Draw paper fill — use seamless tiled texture if assets loaded, else solid color
    const texImg = assetsReady() ? getTextureImages()[el.textureIdx] : null;
    const bw = el.paper.bounds.w;
    const bh = el.paper.bounds.h;

    if (el.paper.mask) {
      // glyphCutout: render texture/fill clipped to glyph outline mask
      const tmp = document.createElement('canvas');
      tmp.width = bw;
      tmp.height = bh;
      const tctx = tmp.getContext('2d');
      if (texImg) {
        const pattern = tctx.createPattern(texImg, 'repeat');
        tctx.fillStyle = pattern;
        const ox = -(el.index * 37) % Math.max(1, texImg.naturalWidth || 100);
        const oy = -(el.index * 53) % Math.max(1, texImg.naturalHeight || 100);
        tctx.translate(ox, oy);
        tctx.fillRect(-ox, -oy, bw + Math.abs(ox) + 100, bh + Math.abs(oy) + 100);
      } else {
        tctx.fillStyle = el.fillColor;
        tctx.fillRect(0, 0, bw, bh);
      }
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.globalCompositeOperation = 'destination-in';
      tctx.drawImage(el.paper.mask, 0, 0);
      ctx.drawImage(tmp, 0, 0);
    } else if (texImg) {
      ctx.save();
      ctx.clip(el.paper.path);
      const pattern = ctx.createPattern(texImg, 'repeat');
      ctx.fillStyle = pattern;
      const ox = -(el.index * 37) % Math.max(1, texImg.naturalWidth || 100);
      const oy = -(el.index * 53) % Math.max(1, texImg.naturalHeight || 100);
      ctx.translate(ox, oy);
      ctx.fillRect(-ox, -oy, bw + Math.abs(ox) + 100, bh + Math.abs(oy) + 100);
      ctx.restore();
    } else {
      ctx.fillStyle = el.fillColor;
      ctx.fill(el.paper.path);
    }

    // Draw text with stroke (描边) — layered approach
    ctx.font = el.fontCss;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Use shape geometric center, adjusted by glyph's actual offset from em-box center
    // glyphCutout already centers text in mask, so skip ox/oy offset
    const baseX = el.paper.center ? el.paper.center.x : el.paper.bounds.w / 2;
    const baseY = el.paper.center ? el.paper.center.y : el.paper.bounds.h / 2;
    const isGlyphCutout = el.paper.type === 'glyphCutout';
    // Only glyphCutout skips offset (text pre-centered in mask).
    // All others (including punctuation) subtract ox/oy to center glyph in paper.
    // Punctuation's natural position comes from the element position offset in layout.js.
    const textX = baseX - (isGlyphCutout ? 0 : (el.glyphOx || 0));
    const textY = baseY - (isGlyphCutout ? 0 : (el.glyphOy || 0));

    // Layer 2: text stroke outline (only if strokeW > 0, random per element)
    if (el.strokeW > 0) {
      const TEST_STROKE_COLORS = ['#ff0000','#0066ff','#00aa44','#ff6600','#cc00cc','#00cccc','#ff0066','#996600'];
      ctx.strokeStyle = TEST_STROKE_COLORS[el.index % TEST_STROKE_COLORS.length];
      ctx.lineWidth = el.strokeW;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(el.text, textX, textY);
    }

    // Layer 3: text fill on top (same position)
    ctx.fillStyle = el.strokeColor;
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
