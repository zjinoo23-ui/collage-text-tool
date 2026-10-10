// paper.js - Three-layer paper generation: shape (glyph) + tear (seed) + texture (asset)

// ── Tunable thresholds (初值，后续可调) ──
const TH = {
  glyphCutoutProb: 0.25,  // 字形裁剪的概率（剩余为矩形 0.75）
  glyphCutoutPad: 0.0875, // 字形裁剪的描边厚度（占字号比例）
  // ── 矩形纸片：预防式扇形约束模型 ──
  safeMarginRatio: 0.04, // 安全框边距（占字号比例）
  fanRadiusRatio: 0.12,  // 顶点扇形半径（占字号比例）
  maxRotationDeg: 12,    // 最大旋转角度（用于字形裁剪保守余量计算）
};

// ── Edge tear styles (参数均为相对字符尺寸比例) ──
const TEAR_STYLES = {
  straight: { type: 'straight' },                                    // 直剪：零扰动
  fine:     { ampPct: 0.025, spacing: 8 },                            // 细腻：2-3% 振幅，6-10px 间距
  rough:    { ampPct: 0.06, spacing: 15 },                            // 粗糙：10-15% 振幅，20-40px 间距
  wavy:     { ampPct: 0.065, wavelengthRatio: 0.25 },                 // 波浪：5-8% 振幅，1/4 字符宽波长
};
export const TEAR_STYLE_KEYS = Object.keys(TEAR_STYLES);

// Offscreen canvas for glyph analysis
let _measureCanvas = null;
function getMeasureCanvas() {
  if (!_measureCanvas) {
    _measureCanvas = document.createElement('canvas');
    _measureCanvas.width = 300;
    _measureCanvas.height = 300;
  }
  return _measureCanvas;
}

/**
 * Analyze a glyph to extract shape features.
 * @param {string} text - The unit text
 * @param {string} fontCss - Canvas font string
 * @param {CanvasRenderingContext2D} ctx - Main ctx (for font fallback)
 * @returns {{r:number, t:number, theta:number, w:number, h:number}}
 */
export function analyzeGlyph(text, fontCss) {
  const canvas = getMeasureCanvas();
  const mctx = canvas.getContext('2d');
  const fs = 100; // analyze at fixed large size for accuracy
  // Size canvas to fit text: at 100px, each char ~60px avg
  const aSize = Math.max(300, Math.ceil(text.length * 60 + 100));
  canvas.width = aSize;
  canvas.height = aSize;
  mctx.clearRect(0, 0, aSize, aSize);
  mctx.font = fontCss.replace(/[\d.]+px/, fs + 'px');
  mctx.fillStyle = '#000';
  mctx.textAlign = 'center';
  mctx.textBaseline = 'middle';
  mctx.fillText(text, aSize / 2, aSize / 2);

  const imgData = mctx.getImageData(0, 0, aSize, aSize).data;
  let minX = aSize, maxX = 0, minY = aSize, maxY = 0;
  const rowCenters = []; // {y, cx} for tilt regression
  const rowWidths = new Map(); // y -> width (for top/bottom ratio)

  for (let y = 0; y < aSize; y++) {
    let rowMinX = aSize, rowMaxX = 0, rowCount = 0;
    for (let x = 0; x < aSize; x++) {
      const alpha = imgData[(y * aSize + x) * 4 + 3];
      if (alpha > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (x < rowMinX) rowMinX = x;
        if (x > rowMaxX) rowMaxX = x;
        rowCount++;
      }
    }
    if (rowCount > 0) {
      rowWidths.set(y, rowMaxX - rowMinX);
      rowCenters.push({ y, cx: (rowMinX + rowMaxX) / 2 });
    }
  }

  if (maxX <= minX || maxY <= minY) {
    return { r: 1, t: 1, theta: 0, w: 100, h: 100, ox: 0, oy: 0 };
  }

  let w = maxX - minX;
  let h = maxY - minY;
  let r = w / h;
  r = Math.max(0.35, Math.min(2.8, r));
  // Glyph center offset from draw point (aSize/2, aSize/2) at 100px
  const ox = (minX + maxX) / 2 - aSize / 2;
  const oy = (minY + maxY) / 2 - aSize / 2;

  // Top/bottom width ratio (t)
  const topStart = minY;
  const topEnd = minY + h / 3;
  const botStart = minY + (2 * h) / 3;
  const botEnd = maxY;
  let topSum = 0, topN = 0, botSum = 0, botN = 0;
  for (const [y, wd] of rowWidths) {
    if (y >= topStart && y <= topEnd) { topSum += wd; topN++; }
    if (y >= botStart && y <= botEnd) { botSum += wd; botN++; }
  }
  const topAvg = topN > 0 ? topSum / topN : w;
  const botAvg = botN > 0 ? botSum / botN : w;
  const t = botAvg > 0 ? topAvg / botAvg : 1;

  // Tilt angle (θ) via linear regression of row-center vs row-y
  let theta = 0;
  if (rowCenters.length >= 5) {
    const n = rowCenters.length;
    let sumY = 0, sumCx = 0, sumYCx = 0, sumY2 = 0;
    for (const rc of rowCenters) {
      sumY += rc.y; sumCx += rc.cx; sumYCx += rc.y * rc.cx; sumY2 += rc.y * rc.y;
    }
    const denom = n * sumY2 - sumY * sumY;
    if (Math.abs(denom) > 0.001) {
      const slope = (n * sumYCx - sumY * sumCx) / denom;
      theta = Math.atan(slope) * 180 / Math.PI;
    }
  }

  return { r, t, theta, w, h, ox, oy };
}

let _measCanvas;
function getMeasCanvas() {
  if (!_measCanvas) _measCanvas = document.createElement('canvas');
  return _measCanvas;
}

/**
 * Measure real pixel bounds of text rendered at actual fontSize.
 * Returns { w, h, ox, oy } where ox/oy is glyph center offset from draw center.
 */
export function measureRealBounds(text, fontCss, fontSize, strokeW = 0) {
  const canvas = getMeasCanvas();
  const size = Math.ceil(Math.max(fontSize * 3, fontSize * 0.6 * (text.length + 2)));
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.font = fontCss;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.miterLimit = 2;
  if (strokeW > 0) {
    ctx.lineWidth = strokeW;
    ctx.strokeStyle = '#000';
    ctx.strokeText(text, size / 2, size / 2);
  }
  ctx.fillText(text, size / 2, size / 2);
  const data = ctx.getImageData(0, 0, size, size).data;
  let minX = size, minY = size, maxX = 0, maxY = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[(y * size + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX) {
    return { w: fontSize * 0.5, h: fontSize * 0.5, ox: 0, oy: 0 };
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const ox = (minX + maxX) / 2 - size / 2;
  const oy = (minY + maxY) / 2 - size / 2;
  return { w, h, ox, oy };
}

/**
 * Classify shape based on glyph features and probabilities.
 * 标点→矩形；否则按概率分配字形裁剪/矩形。
 * @returns {string} 'rect' | 'glyphCutout'
 */
export function classifyShape(glyph, rng, isPunct = false) {
  if (isPunct) return 'rect';
  const roll = rng.range(0, 1);
  if (roll < TH.glyphCutoutProb) return 'glyphCutout';
  return 'rect';
}

/**
 * Generate corners using the preventive fan constraint model.
 * 顶点在安全框四角的 1/4 圆扇形内随机取点，纸片天然包住安全框。
 * 扇形方向朝四角外侧（TL↖ TR↗ BR↘ BL↙）。
 */
function buildCorners(fanCorners, fanRadius, rng) {
  const baseFanAngles = [
    [Math.PI, Math.PI * 1.5],       // TL: up-left
    [Math.PI * 1.5, Math.PI * 2],  // TR: up-right
    [0, Math.PI * 0.5],             // BR: down-right
    [Math.PI * 0.5, Math.PI],       // BL: down-left
  ];
  const corners = fanCorners.slice(0, 4).map((fc, i) => {
    const angle = rng.range(...baseFanAngles[i]);
    const mag = rng.range(0, fanRadius);
    return { x: fc.x + Math.cos(angle) * mag, y: fc.y + Math.sin(angle) * mag };
  });
  // normalize to 0,0
  const minX = Math.min(...corners.map(c => c.x));
  const minY = Math.min(...corners.map(c => c.y));
  return corners.map(c => ({ x: c.x - minX, y: c.y - minY }));
}

/**
 * Apply edge tear style to corners, producing a Path2D.
 */
function applyTear(corners, tearKey, rng, charSize, safeBox = null) {
  const style = TEAR_STYLES[tearKey] || TEAR_STYLES.straight;
  const path = new Path2D();

  // 安全框约束：沿法线方向限制向内的撕裂偏移
  // 不区分斜边/直边，统一沿边的法线方向计算到 safeBox 入口边界的距离
  // 关键：计算的是"进入"safeBox 的距离（近边界），不是"穿出"的距离（远边界）
  const inwardSpace = (bx, by, nx, ny) => {
    if (!safeBox) return Infinity;
    let t = Infinity;
    // nx > 0 (向右内)：先碰到 safeMinX（左边界 = 入口）
    if (nx > 1e-6) t = Math.min(t, (safeBox.safeMinX - bx) / nx);
    // nx < 0 (向左内)：先碰到 safeMaxX（右边界 = 入口）
    if (nx < -1e-6) t = Math.min(t, (safeBox.safeMaxX - bx) / nx);
    // ny > 0 (向下内)：先碰到 safeMinY（上边界 = 入口）
    if (ny > 1e-6) t = Math.min(t, (safeBox.safeMinY - by) / ny);
    // ny < 0 (向上内)：先碰到 safeMaxY（下边界 = 入口）
    if (ny < -1e-6) t = Math.min(t, (safeBox.safeMaxY - by) / ny);
    return t;
  };
  const tearPoint = (bx, by, nx, ny, offset) => {
    if (!safeBox) return { x: bx + nx * offset, y: by + ny * offset };
    const space = inwardSpace(bx, by, nx, ny);
    const safety = 5;
    if (offset <= 0) return { x: bx + nx * offset, y: by + ny * offset };
    const maxInward = Math.max(0, space - safety);
    const falloff = Math.max(2, charSize * 0.03);
    let finalOffset;
    if (maxInward <= 0) finalOffset = 0;
    else if (offset <= maxInward - falloff) finalOffset = offset;
    else {
      const k = Math.min(1, (offset - (maxInward - falloff)) / falloff);
      finalOffset = maxInward - falloff * k * k;
    }
    return { x: bx + nx * finalOffset, y: by + ny * finalOffset };
  };

  if (style.type === 'straight') {
    path.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) path.lineTo(corners[i].x, corners[i].y);
    path.closePath();
    return path;
  }

  const allPoints = [];

  for (let i = 0; i < corners.length; i++) {
    const from = corners[i];
    const to = corners[(i + 1) % corners.length];
    allPoints.push({ ...from });

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const edgeLen = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / edgeLen;
    const ny = dx / edgeLen;

    if (style.type === 'wavy') {
      // Sine wave along the edge
      const wavelength = charSize * style.wavelengthRatio;
      const amp = charSize * style.ampPct;
      const steps = Math.max(8, Math.floor(edgeLen / (wavelength / 6)));
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1);
        const bx = from.x + dx * t;
        const by = from.y + dy * t;
        const phase = (edgeLen * t / wavelength) * Math.PI * 2;
        const offset = Math.sin(phase) * amp;
        allPoints.push(tearPoint(bx, by, nx, ny, offset));
      }
    } else {
      // Jagged tear (fine or rough)
      const spacing = style.spacing;
      const amp = charSize * style.ampPct;
      const steps = Math.max(3, Math.floor(edgeLen / spacing));
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1);
        const bx = from.x + dx * t;
        const by = from.y + dy * t;
        const offset = rng.range(-1, 1) * amp;
        allPoints.push(tearPoint(bx, by, nx, ny, offset));
      }
    }
  }

  path.moveTo(allPoints[0].x, allPoints[0].y);
  for (let i = 1; i < allPoints.length; i++) {
    const prev = allPoints[i - 1];
    const curr = allPoints[i];
    const cpx = (prev.x + curr.x) / 2;
    const cpy = (prev.y + curr.y) / 2;
    path.quadraticCurveTo(cpx, cpy, curr.x, curr.y);
  }
  path.closePath();
  return path;
}

/**
 * Generate a paper: shape from glyph, tear from seed (tearKey), texture handled by renderer.
 * 旋转不在此阶段处理——由渲染器在 Pass 3 做变换。
 * @param {object} glyph - From analyzeGlyph()
 * @param {string} shapeType - 'rect' | 'glyphCutout'
 * @param {string} tearKey - One of TEAR_STYLE_KEYS (seed-driven)
 * @param {number} textWidth - measured text width (including stroke)
 * @param {number} textHeight - measured text height (including stroke)
 * @param {object} rng - position rng for corner jitter
 * @param {boolean} isPunct - smaller padding for punctuation
 * @returns {object} { path, bounds:{w,h}, center, type, tear, textOffset }
 */
export function generatePaper(glyph, shapeType, tearKey, textWidth, textHeight, rng, isPunct = false, text = '', fontCss = '', fontSize = 0, strokeW = 0) {
  // ── glyphCutout: paper hugs the glyph outline with thick padding ──
  // 旋转不在此处理——渲染阶段 mask 和文字一起旋转，相对位置不变
  // bounds 用 mask 实际非透明像素边界，不用整个画布尺寸
  if (shapeType === 'glyphCutout' && text && fontCss) {
    const pad = fontSize * TH.glyphCutoutPad;
    const maskPad = Math.max(pad, (strokeW || 0) / 2) + 2;
    const extraPad = maskPad + 4;
    const cw = Math.ceil(textWidth + extraPad * 2);
    const ch = Math.ceil(textHeight + extraPad * 2);
    const mask = document.createElement('canvas');
    mask.width = cw;
    mask.height = ch;
    const mctx = mask.getContext('2d');
    mctx.font = fontCss;
    mctx.textAlign = 'center';
    mctx.textBaseline = 'middle';
    mctx.lineJoin = 'round';
    mctx.lineCap = 'round';
    mctx.miterLimit = 2;
    mctx.strokeStyle = '#000';
    mctx.fillStyle = '#000';
    if (strokeW > 0) {
      mctx.lineWidth = strokeW;
      mctx.strokeText(text, cw / 2, ch / 2);
    }
    mctx.lineWidth = maskPad * 2;
    mctx.strokeText(text, cw / 2, ch / 2);
    mctx.fillText(text, cw / 2, ch / 2);

    // 扫描 mask 实际边界，得到 bounds
    const imgData = mctx.getImageData(0, 0, cw, ch).data;
    let minX = cw, maxX = 0, minY = ch, maxY = 0;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        if (imgData[(y * cw + x) * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    // 四周各加 1px 安全余量
    minX = Math.max(0, minX - 1);
    minY = Math.max(0, minY - 1);
    maxX = Math.min(cw - 1, maxX + 1);
    maxY = Math.min(ch - 1, maxY + 1);
    const boundsW = maxX - minX + 1;
    const boundsH = maxY - minY + 1;

    return {
      path: null,
      mask,
      maskOffset: { x: minX, y: minY },  // mask 内有效区域起点
      bounds: { w: boundsW, h: boundsH },
      center: { x: cw / 2, y: ch / 2 },
      type: 'glyphCutout',
      tear: 'straight',
      textOffset: { x: (cw - textWidth) / 2, y: (ch - textHeight) / 2 }
    };
  }

  // ── 矩形：预防式扇形约束模型 ──
  // ① 文本框 → ② 安全框 → ③ 扇形(安全框四角) → ④ 顶点在扇形内随机 → 纸片
  const strokePad = strokeW > 0 ? 2 : 0;
  const safeMargin = fontSize * TH.safeMarginRatio + strokePad;
  const fanR = fontSize * TH.fanRadiusRatio;

  // 描边后的文本框尺寸（用于安全框计算）
  const sw = textWidth + strokePad * 2;
  const sh = textHeight + strokePad * 2;

  // 安全框四角（以描边后文本框左上角为原点）
  const fanCorners = [
    { x: -safeMargin, y: -safeMargin },           // TL
    { x: sw + safeMargin, y: -safeMargin },       // TR
    { x: sw + safeMargin, y: sh + safeMargin },   // BR
    { x: -safeMargin, y: sh + safeMargin },       // BL
  ];

  const corners = buildCorners(fanCorners, fanR, rng);

  let minX = Math.min(...corners.map(c => c.x));
  let minY = Math.min(...corners.map(c => c.y));
  let maxX = Math.max(...corners.map(c => c.x));
  let maxY = Math.max(...corners.map(c => c.y));
  let normCorners = corners.map(c => ({ x: c.x - minX, y: c.y - minY }));
  let boundsW = maxX - minX;
  let boundsH = maxY - minY;

  // 安全框（用于撕裂约束）：文本以质心为中心，safeBox = 文本框 + safeMargin
  const cx = normCorners.reduce((s, c) => s + c.x, 0) / normCorners.length;
  const cy = normCorners.reduce((s, c) => s + c.y, 0) / normCorners.length;
  const safeBox = {
    safeMinX: cx - sw / 2 - safeMargin,
    safeMaxX: cx + sw / 2 + safeMargin,
    safeMinY: cy - sh / 2 - safeMargin,
    safeMaxY: cy + sh / 2 + safeMargin
  };

  const charSize = Math.min(boundsW, boundsH);
  const path = applyTear(normCorners, tearKey, rng, charSize, safeBox);

  return {
    path,
    bounds: { w: boundsW, h: boundsH },
    center: { x: cx, y: cy },
    type: 'rect',
    tear: tearKey,
    textOffset: { x: cx - textWidth / 2, y: cy - textHeight / 2 }
  };
}

/**
 * Pick a tear style key using seed rng.
 * Can be weakly correlated with shape (square → prefers straight/fine).
 */
export function pickTearStyle(rng, shapeType) {
  if (shapeType === 'glyphCutout') return 'straight';
  const roll = rng.range(0, 1);
  // rect: balanced distribution
  if (roll < 0.15) return 'straight';
  if (roll < 0.45) return 'fine';
  if (roll < 0.80) return 'rough';
  return 'wavy';
}
