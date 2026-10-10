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

  // Pass 1: 确定"长什么样"——只用 styleRng（只由 seed+text 决定，UI 参数不影响）
  let prevColors = null;
  const items = units.map((unit, i) => {
    const styleRng = createPositionRng(seed, i * 2 + 0);  // 样式 RNG
    const layoutRng = createPositionRng(seed, i * 2 + 1); // 布局 RNG

    // ── 样式部分：只用 styleRng ──
    // 始终消耗 RNG 保证顺序稳定，toggles 只决定是否使用随机结果
    const randomFontIdx = styleRng.int(0, getFontCount() - 1);
    const fontIdx = toggles.font ? randomFontIdx : 0;
    const glyph = analyzeGlyph(unit.text, getFontCss(fontIdx, 100));
    const shapeType = classifyShape(glyph, styleRng, unit.isPunct);
    const tearKey = pickTearStyle(styleRng, shapeType);

    // Random stroke（样式的一部分，由 styleRng 决定）
    const hasStrokeEarly = styleRng.chance(0.45);
    const strokeRatio = hasStrokeEarly ? styleRng.range(0.08, 0.22) : 0;

    // 配色（固定小幅度漂移，不受 randomAmount 影响）
    const charColorScheme = toggles.color
      ? createColorScheme(createRng(seed + i * 997), 0.15)
      : colorScheme;
    const { fill: fillColor, text: textColor, stroke: strokeColor } = charColorScheme.getColors(styleRng, prevColors);
    prevColors = { fill: fillColor, text: textColor, stroke: strokeColor };

    // 纹理
    const textureIdx = styleRng.int(0, TEXTURES.length - 1);

    // ── 布局部分：用 layoutRng 和 UI 参数 ──
    let fontSize = baseFontSize;
    if (toggles.size) fontSize = baseFontSize * layoutRng.range(0.85, 1.15);
    const fontCss = getFontCss(fontIdx, fontSize);
    ctx.font = fontCss;

    // strokeW 是 strokeRatio * fontSize，fontSize 是布局参数，但 strokeRatio 是样式
    const strokeWEarly = strokeRatio * fontSize;

    // 测量真实边界
    const real = measureRealBounds(unit.text, fontCss, fontSize, strokeWEarly);
    const textW = real.w;
    const textH = real.h;
    const glyphOx = real.ox;
    const glyphOy = real.oy;

    // 生成纸片（样式 RNG）
    const paper = generatePaper(glyph, shapeType, tearKey, textW, textH, styleRng, unit.isPunct, unit.text, fontCss, fontSize, strokeWEarly);

    return { unit, styleRng, layoutRng, fontIdx, fontSize, fontCss, textW, textH, paper, fillColor, textColor, strokeColor, textureIdx, layoutW: paper.bounds.w, index: i, glyphOx, glyphOy, strokeW: strokeWEarly };
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
      const layoutRng = item.layoutRng;
      const isPunct = item.unit.isPunct;

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
      const floatY = layoutRng.range(-floatRange, floatRange) * item.textH * randomFactor;

      // 随机旋转（用 layoutRng，randomAmount 控制幅度）
      const rotation = layoutRng.range(-MAX_ROTATION, MAX_ROTATION) * randomFactor * (Math.PI / 180);

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
