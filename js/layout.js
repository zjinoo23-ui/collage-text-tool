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
  const spaceExtra = baseFontSize * 0.4;  // 空格的额外间距
  const lineGap = baseFontSize * 0.55;

  // Pass 1: 确定"长什么样"——只用 styleRng（只由 seed+text 决定，UI 参数不影响）
  let prevColors = null;
  const items = [];
  let atLineStart = true;       // 是否处于行首（文本开头或换行后）
  let pendingLeading = 0;       // 行首连续空格数（用于首行缩进）
  units.forEach((unit, i) => {
    // 换行：只作为排版断点，不生成纸片
    if (unit.isBreak) {
      items.push({ unit, isBreakMarker: true, index: i });
      atLineStart = true;
      pendingLeading = 0;
      return;
    }
    // 空格：行首 -> 缩进；行中 -> 给前一个纸片累加间距
    if (unit.isSpace) {
      if (atLineStart) {
        pendingLeading += 1;
      } else {
        const prev = items[items.length - 1];
        if (prev && !prev.isBreakMarker) prev.spaceCount += 1;
      }
      return;
    }

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

    items.push({ unit, styleRng, layoutRng, fontIdx, fontSize, fontCss, textW, textH, paper, fillColor, textColor, strokeColor, textureIdx, layoutW: paper.bounds.w, index: i, glyphOx, glyphOy, strokeW: strokeWEarly, spaceCount: 0, leadingSpaces: pendingLeading });
    pendingLeading = 0;
    atLineStart = false;
  });

  // Pass 2: Line wrapping
  const lines = wrapLines(items, contentW, gap, spaceExtra);

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
    const lineIndent = (line[0]?.leadingSpaces ?? 0) * spaceExtra;
    let totalLineW = lineIndent;
    line.forEach((item, i) => {
      totalLineW += item.layoutW;
      if (i < line.length - 1) totalLineW += gap + item.spaceCount * spaceExtra;
    });

    let x = contentX;
    if (align === 'center') x = contentX + (contentW - totalLineW) / 2;
    else if (align === 'right') x = contentX + contentW - totalLineW;
    else if (align === 'indent' && lineIdx === 0) {
      // Indent by 2 paper widths (use first 2 items, or estimate from fontSize)
      const indentW = line.length >= 2
        ? line[0].layoutW + gap + line[0].spaceCount * spaceExtra + line[1].layoutW
        : (line[0]?.layoutW ?? baseFontSize) * 2;
      x = contentX + indentW;
    }
    x += lineIndent;

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
      x += item.layoutW + gap + item.spaceCount * spaceExtra;
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
 * - 英文单词（同一 wordId 的字符）整词不可拆到两行
 * - 空格只产生额外间距，不占用纸片
 */
function wrapLines(items, maxWidth, gap, spaceExtra) {
  const lines = [];
  let currentLine = [];
  let currentWidth = 0;

  function gapAfter(prevItem) {
    const n = prevItem ? prevItem.spaceCount : 0;
    return gap + n * spaceExtra;
  }

  function flush() {
    if (currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [];
      currentWidth = 0;
    }
  }

  // 单个纸片的放置（标点规则 + 超长兜底）
  function addItem(item) {
    const prev = currentLine[currentLine.length - 1];

    // 行首：应用首行缩进
    if (!prev) {
      currentLine.push(item);
      currentWidth = (item.leadingSpaces || 0) * spaceExtra + item.layoutW;
      return;
    }

    const totalIfAdded = currentWidth + gapAfter(prev) + item.layoutW;

    if (totalIfAdded > maxWidth) {
      // Handle punctuation: don't let punctuation start a new line
      if (NO_START_PUNCT.test(item.unit.text)) {
        // Try to fit on current line with slight overflow
        if (totalIfAdded <= maxWidth * 1.1) {
          currentLine.push(item);
          currentWidth = totalIfAdded;
          return;
        }
        // Move last item + punctuation to new line together
        const lastItem = currentLine.pop();
        if (currentLine.length > 0) lines.push(currentLine);
        currentLine = [lastItem, item];
        currentWidth = (lastItem.leadingSpaces || 0) * spaceExtra + lastItem.layoutW + gapAfter(lastItem) + item.layoutW;
        return;
      }

      lines.push(currentLine);
      currentLine = [item];
      currentWidth = (item.leadingSpaces || 0) * spaceExtra + item.layoutW;
    } else {
      currentLine.push(item);
      currentWidth = totalIfAdded;
    }
  }

  let i = 0;
  while (i < items.length) {
    const item = items[i];

    // 强制换行
    if (item.isBreakMarker) {
      flush();
      i++;
      continue;
    }

    // 收集同一英文单词的所有字符，作为不可拆分的整体
    const group = [item];
    let next = i + 1;
    if (item.unit.wordId !== undefined && item.unit.wordId !== null) {
      while (next < items.length && !items[next].isBreakMarker &&
             items[next].unit.wordId === item.unit.wordId) {
        group.push(items[next]);
        next++;
      }
    }
    i = next;

    if (group.length === 1) {
      addItem(item);
      continue;
    }

    // 整词宽度（含词内间距）
    let groupWidth = 0;
    for (let k = 0; k < group.length; k++) {
      groupWidth += group[k].layoutW + (k > 0 ? gapAfter(group[k - 1]) : 0);
    }

    // 整词单独一行都放不下：只能按字符换行兜底
    if (groupWidth > maxWidth) {
      group.forEach(addItem);
      continue;
    }

    const prev = currentLine[currentLine.length - 1];
    const groupIndent = (group[0].leadingSpaces || 0) * spaceExtra;
    const totalIfAdded = (prev ? currentWidth + gapAfter(prev) : groupIndent) + groupWidth;

    if (prev && totalIfAdded > maxWidth) {
      flush();
      currentLine = group.slice();
      currentWidth = groupIndent + groupWidth;
    } else {
      currentLine.push(...group);
      currentWidth = totalIfAdded;
    }
  }

  flush();
  return lines;
}
