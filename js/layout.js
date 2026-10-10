// layout.js - Layout engine: line wrapping, alignment, positioning

import { createPositionRng, createRng } from './rng.js';
import { getFontCss, getFontCount } from './fonts.js';
import { analyzeGlyph, classifyShape, pickTearStyle, generatePaper, measureRealBounds } from './paper.js';
import { TEXTURES } from './assets.js';
import { createColorScheme } from './palettes.js';

// Chinese punctuation that should NOT appear at line start
const NO_START_PUNCT = /^[，。、；：！？""''）》】』」…—]$/;

// Max rotation in degrees
const MAX_ROTATION = 12;
// Max vertical float as fraction of char height
const MAX_FLOAT = 0.4;

export const SIZES = {
  square: { w: 2048, h: 2048 },
  portrait: { w: 1080, h: 1440 },
  wallpaper: { w: 1290, h: 2796 }
};

/**
 * Compute layout for the given input.
 */
export function computeLayout(params) {
  const { units, sizeKey, bgType, align, seed, randomAmount, scale, toggles, colorScheme, ctx } = params;

  const size = SIZES[sizeKey];
  const isTransparent = bgType === 'transparent';

  const bleed = isTransparent ? Math.min(size.w, size.h) * 0.08 : size.w * 0.06;
  const contentX = bleed;
  const contentY = bleed;
  const contentW = size.w - bleed * 2;
  const contentH = size.h - bleed * 2;

  // Base font size proportional to canvas width
  let baseFontSize = size.w * 0.05 * scale;
  if (sizeKey === 'wallpaper') baseFontSize = size.w * 0.04 * scale;

  // Try layout, auto-shrink if vertical overflow
  let result;
  for (let attempt = 0; attempt < 5; attempt++) {
    result = computeLayoutWithFontSize({
      units, sizeKey, isTransparent, bleed, contentX, contentY, contentW, contentH,
      align, seed, randomAmount, baseFontSize, toggles, colorScheme, ctx
    });
    if (result.totalH <= contentH) break;
    // Shrink font by 15% and retry
    baseFontSize *= 0.85;
  }

  return result.layout;
}

function computeLayoutWithFontSize(p) {
  const { units, isTransparent, bleed, contentX, contentY, contentW, contentH,
    align, seed, randomAmount, baseFontSize, toggles, colorScheme, ctx } = p;

  const randomFactor = randomAmount / 100;
  const gap = baseFontSize * 0.15;
  const lineGap = baseFontSize * 0.55;

  // Pass 1: Analyze glyphs, classify shapes, pick tear styles, generate papers
  let prevColors = null; // 记录上一个字的颜色，用于避免相邻同色
  const items = units.map((unit, i) => {
    const posRng = createPositionRng(seed, i);
    let fontIdx = 0;
    if (toggles.font) fontIdx = posRng.int(0, getFontCount() - 1);
    let fontSize = baseFontSize;
    if (toggles.size) fontSize = baseFontSize * posRng.range(0.85, 1.15);
    const fontCss = getFontCss(fontIdx, fontSize);
    ctx.font = fontCss;

    // Layer 1: analyze glyph at 100px ONLY for shape features (theta/tilt)
    const glyph = analyzeGlyph(unit.text, fontCss);
    const shapeType = classifyShape(glyph, posRng, unit.isPunct);

    // Layer 2: pick tear style (seed-driven, weakly correlated with shape)
    const tearKey = pickTearStyle(posRng, shapeType);

    // Random stroke: ~45% chance, thickness 0.08~0.22 * fontSize
    // Must be computed BEFORE measureRealBounds so bounds include stroke
    const hasStrokeEarly = posRng.chance(0.45);
    const strokeWEarly = hasStrokeEarly ? posRng.range(0.08, 0.22) * fontSize : 0;

    // Measure real bounds INCLUDING stroke, so safeBox accounts for stroked glyph
    const real = measureRealBounds(unit.text, fontCss, fontSize, strokeWEarly);
    const textW = real.w;
    const textH = real.h;
    const glyphOx = real.ox;
    const glyphOy = real.oy;

    // Generate paper (shape + tear; rotation is NOT here—handled in Pass 3)
    const paper = generatePaper(glyph, shapeType, tearKey, textW, textH, posRng, unit.isPunct, unit.text, fontCss, fontSize, strokeWEarly);

    // 每个字独立选一套配色方案（用 seed + index 派生 RNG）
    const drift = (randomAmount / 100) * 0.5;
    const charColorScheme = toggles.color
      ? createColorScheme(createRng(seed + i * 997), drift)
      : colorScheme;
    const { fill: fillColor, text: textColor, stroke: strokeColor } = charColorScheme.getColors(posRng, prevColors);
    prevColors = { fill: fillColor, text: textColor, stroke: strokeColor };

    // 随机纹理索引（和配色一起选）
    const textureIdx = posRng.int(0, TEXTURES.length - 1);

    return { unit, posRng, fontIdx, fontSize, fontCss, textW, textH, paper, fillColor, textColor, strokeColor, textureIdx, layoutW: paper.bounds.w, index: i, glyphOx, glyphOy, strokeW: strokeWEarly };
  });

  // Pass 2: Line wrapping
  const lines = wrapLines(items, contentW, gap);

  // Pass 3: Position
  const lineHeights = lines.map(line => {
    let maxH = 0;
    for (const item of line) maxH = Math.max(maxH, item.paper.bounds.h);
    return maxH + lineGap;
  });

  const totalContentH = lineHeights.reduce((a, b) => a + b, 0);
  let startY = contentY;
  if (totalContentH < contentH) {
    startY = contentY + (contentH - totalContentH) / 2;
  }

  const elements = [];
  let currentY = startY;
  const size = { w: p.sizeKey ? SIZES[p.sizeKey].w : 0, h: p.sizeKey ? SIZES[p.sizeKey].h : 0 };

  lines.forEach((line, lineIdx) => {
    const lineH = lineHeights[lineIdx];
    let totalLineW = 0;
    line.forEach((item, i) => {
      totalLineW += item.layoutW;
      if (i < line.length - 1) totalLineW += gap;
    });

    let x = contentX;
    if (align === 'center') x = contentX + (contentW - totalLineW) / 2;
    else if (align === 'right') x = contentX + contentW - totalLineW;
    else if (align === 'indent' && lineIdx === 0) {
      // Indent by 2 paper widths (use first 2 items, or estimate from fontSize)
      const indentW = line.length >= 2
        ? line[0].layoutW + gap + line[1].layoutW
        : (line[0]?.layoutW ?? baseFontSize) * 2;
      x = contentX + indentW;
    }

    line.forEach((item) => {
      const posRng = item.posRng;
      const isPunct = item.unit.isPunct;

      // Use stroke computed in Pass 1 (before generatePaper)
      const strokeW = item.strokeW;

      // Punctuation: smaller float, near line center
      let yPos, floatRange;
      if (isPunct) {
        yPos = currentY + lineH * 0.5;
        floatRange = MAX_FLOAT * 0.3;
      } else {
        yPos = currentY + lineH / 2;
        floatRange = MAX_FLOAT;
      }
      const floatY = posRng.range(-floatRange, floatRange) * item.textH * randomFactor;

      // 随机旋转（最后一步）
      const rotation = posRng.range(-MAX_ROTATION, MAX_ROTATION) * randomFactor * (Math.PI / 180);

      // Punctuation: paper follows glyph's natural position (offset by ox/oy)
      const posOX = isPunct ? item.glyphOx : 0;
      const posOY = isPunct ? item.glyphOy : 0;
      elements.push({
        text: item.unit.text, fontCss: item.fontCss, fontSize: item.fontSize,
        textW: item.textW, textH: item.textH, paper: item.paper,
        fillColor: item.fillColor, textColor: item.textColor, strokeColor: item.strokeColor,
        x: x + item.layoutW / 2 + posOX, y: yPos + floatY + posOY,
        rotation, index: item.index, strokeW, isPunct,
        textureIdx: item.textureIdx,
        glyphOx: item.glyphOx, glyphOy: item.glyphOy
      });
      x += item.layoutW + gap;
    });
    currentY += lineH;
  });

  return {
    totalH: totalContentH,
    layout: { elements, canvasSize: SIZES[p.sizeKey], bleed, isTransparent }
  };
}

/**
 * Wrap items into lines respecting rules:
 * - Uses paper (layout) width for wrapping decisions
 * - No punctuation at line start
 * - Items are never split (each is atomic)
 */
function wrapLines(items, maxWidth, gap) {
  const lines = [];
  let currentLine = [];
  let currentWidth = 0;

  for (const item of items) {
    // Handle forced line break from user input
    if (item.unit.isBreak) {
      if (currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = [];
        currentWidth = 0;
      }
      continue;
    }

    const itemWidth = item.layoutW;
    const needsGap = currentLine.length > 0;
    const totalIfAdded = currentWidth + (needsGap ? gap : 0) + itemWidth;

    // Check if this item would overflow
    if (currentLine.length > 0 && totalIfAdded > maxWidth) {
      // Handle punctuation: don't let punctuation start a new line
      if (NO_START_PUNCT.test(item.unit.text) && currentLine.length > 0) {
        // Try to fit on current line with slight overflow
        if (totalIfAdded <= maxWidth * 1.1) {
          currentLine.push(item);
          currentWidth = totalIfAdded;
          continue;
        }
        // Move last item + punctuation to new line together
        const lastItem = currentLine.pop();
        lines.push(currentLine);
        currentLine = [lastItem, item];
        currentWidth = lastItem.layoutW + gap + itemWidth;
        continue;
      }

      lines.push(currentLine);
      currentLine = [item];
      currentWidth = itemWidth;
    } else {
      currentLine.push(item);
      currentWidth = totalIfAdded;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}
