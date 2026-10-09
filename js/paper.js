// paper.js - Three-layer paper generation: shape (glyph) + tear (seed) + texture (asset)

// ── Tunable thresholds (初值，后续可调) ──
const TH = {
  tiltDeg: 8,            // |θ| ≥ 此值 → 平行四边形
  cornerStretchMax: 0.1, // 四角随机拉伸最大幅度（占短边比例）
  glyphCutoutProb: 0.30, // 非倾斜字形中，字形裁剪的概率
  pentagonProb: 0.25,    // 五边形概率
  hexagonProb: 0.15,     // 六边形概率（剩余为矩形 0.30）
  glyphCutoutPad: 0.35,   // 字形裁剪的描边厚度（占字号比例）
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
  mctx.clearRect(0, 0, 300, 300);
  mctx.font = fontCss.replace(/[\d.]+px/, fs + 'px');
  mctx.fillStyle = '#000';
  mctx.textAlign = 'center';
  mctx.textBaseline = 'middle';
  mctx.fillText(text, 150, 150);

  const imgData = mctx.getImageData(0, 0, 300, 300).data;
  let minX = 300, maxX = 0, minY = 300, maxY = 0;
  const rowCenters = []; // {y, cx} for tilt regression
  const rowWidths = new Map(); // y -> width (for top/bottom ratio)

  for (let y = 0; y < 300; y++) {
    let rowMinX = 300, rowMaxX = 0, rowCount = 0;
    for (let x = 0; x < 300; x++) {
      const alpha = imgData[(y * 300 + x) * 4 + 3];
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
  // Glyph center offset from draw point (150,150) at 100px — for accurate centering
  const ox = (minX + maxX) / 2 - 150;
  const oy = (minY + maxY) / 2 - 150;

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
export function measureRealBounds(text, fontCss, fontSize) {
  const canvas = getMeasCanvas();
  const size = Math.ceil(fontSize * 3);
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.font = fontCss;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
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
 * 标点→矩形；倾斜→平行四边形；否则按概率分配字形裁剪/五边形/六边形/矩形。
 * @returns {string} 'rect' | 'parallelogram' | 'glyphCutout' | 'pentagon' | 'hexagon'
 */
export function classifyShape(glyph, rng, isPunct = false) {
  if (isPunct) return 'rect';
  if (Math.abs(glyph.theta) >= TH.tiltDeg) return 'parallelogram';
  const roll = rng.range(0, 1);
  if (roll < TH.glyphCutoutProb) return 'glyphCutout';
  if (roll < TH.glyphCutoutProb + TH.pentagonProb) return 'pentagon';
  if (roll < TH.glyphCutoutProb + TH.pentagonProb + TH.hexagonProb) return 'hexagon';
  return 'rect';
}

/**
 * Generate base corners, then apply independent random stretch to each corner.
 * 五边形：顶边中间凸起一个角；六边形：顶边和底边各凸起一个角。
 */
function buildCorners(shapeType, baseW, baseH, glyph, rng) {
  // Step 1: base shape
  let corners;
  let outRanges;

  if (shapeType === 'parallelogram') {
    const dir = glyph.theta >= 0 ? 1 : -1;
    const skew = Math.min(baseH * 0.35, Math.abs(glyph.theta) / 15 * baseH * 0.4) * rng.range(0.5, 1.3) * dir;
    corners = [
      { x: Math.abs(skew), y: 0 },
      { x: baseW + skew, y: 0 },
      { x: baseW - skew, y: baseH },
      { x: 0, y: baseH },
    ];
    outRanges = [
      [Math.PI, Math.PI * 1.5],     // TL: up-left
      [Math.PI * 1.5, Math.PI * 2],  // TR: up-right
      [0, Math.PI * 0.5],           // BR: down-right
      [Math.PI * 0.5, Math.PI],      // BL: down-left
    ];
  } else if (shapeType === 'pentagon') {
    // 五边形：顶边中间向上凸起一个角
    const bumpMag = baseH * rng.range(0.08, 0.18);
    corners = [
      { x: 0, y: 0 },                  // TL
      { x: baseW * 0.5, y: -bumpMag }, // top middle（向上凸）
      { x: baseW, y: 0 },              // TR
      { x: baseW, y: baseH },          // BR
      { x: 0, y: baseH },              // BL
    ];
    outRanges = [
      [Math.PI, Math.PI * 1.5],          // TL: up-left
      [Math.PI * 1.25, Math.PI * 1.75],  // top middle: up
      [Math.PI * 1.5, Math.PI * 2],      // TR: up-right
      [0, Math.PI * 0.5],               // BR: down-right
      [Math.PI * 0.5, Math.PI],          // BL: down-left
    ];
  } else if (shapeType === 'hexagon') {
    // 六边形：顶边和底边各凸起一个角
    const bumpMagTop = baseH * rng.range(0.08, 0.18);
    const bumpMagBot = baseH * rng.range(0.08, 0.18);
    corners = [
      { x: 0, y: 0 },                          // TL
      { x: baseW * 0.5, y: -bumpMagTop },     // top middle（向上凸）
      { x: baseW, y: 0 },                      // TR
      { x: baseW, y: baseH },                  // BR
      { x: baseW * 0.5, y: baseH + bumpMagBot }, // bottom middle（向下凸）
      { x: 0, y: baseH },                      // BL
    ];
    outRanges = [
      [Math.PI, Math.PI * 1.5],          // TL: up-left
      [Math.PI * 1.25, Math.PI * 1.75],  // top middle: up
      [Math.PI * 1.5, Math.PI * 2],      // TR: up-right
      [0, Math.PI * 0.5],               // BR: down-right
      [Math.PI * 0.25, Math.PI * 0.75],  // bottom middle: down
      [Math.PI * 0.5, Math.PI],          // BL: down-left
    ];
  } else {
    // rect
    corners = [
      { x: 0, y: 0 },
      { x: baseW, y: 0 },
      { x: baseW, y: baseH },
      { x: 0, y: baseH },
    ];
    outRanges = [
      [Math.PI, Math.PI * 1.5],     // TL: up-left
      [Math.PI * 1.5, Math.PI * 2], // TR: up-right
      [0, Math.PI * 0.5],           // BR: down-right
      [Math.PI * 0.5, Math.PI],      // BL: down-left
    ];
  }

  // Step 2: each corner stretches outward only (prevents triangles/spikes)
  const maxStretch = Math.min(baseW, baseH) * TH.cornerStretchMax;
  corners = corners.map((c, i) => {
    const [a0, a1] = outRanges[i];
    const angle = rng.range(a0, a1);
    const mag = rng.range(0, maxStretch);
    return { x: c.x + Math.cos(angle) * mag, y: c.y + Math.sin(angle) * mag };
  });

  // Step 3: normalize to 0,0
  const minX = Math.min(...corners.map(c => c.x));
  const minY = Math.min(...corners.map(c => c.y));
  return corners.map(c => ({ x: c.x - minX, y: c.y - minY }));
}

/**
 * Apply edge tear style to corners, producing a Path2D.
 */
function applyTear(corners, tearKey, rng, charSize) {
  const style = TEAR_STYLES[tearKey] || TEAR_STYLES.straight;
  const path = new Path2D();

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
        allPoints.push({ x: bx + nx * offset, y: by + ny * offset });
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
        allPoints.push({ x: bx + nx * offset, y: by + ny * offset });
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
 * @param {object} glyph - From analyzeGlyph()
 * @param {string} shapeType - From classifyShape()
 * @param {string} tearKey - One of TEAR_STYLE_KEYS (seed-driven)
 * @param {number} textWidth - measured text width
 * @param {number} textHeight - estimated text height
 * @param {object} rng - position rng for corner jitter
 * @param {boolean} isPunct - smaller padding for punctuation
 * @returns {object} { path, bounds:{w,h}, type }
 */
export function generatePaper(glyph, shapeType, tearKey, textWidth, textHeight, rng, isPunct = false, text = '', fontCss = '', fontSize = 0) {
  // ── glyphCutout: paper hugs the glyph outline with thick padding ──
  if (shapeType === 'glyphCutout' && text && fontCss) {
    const pad = fontSize * TH.glyphCutoutPad;
    const cw = Math.ceil(textWidth + pad * 2 + 4);
    const ch = Math.ceil(textHeight + pad * 2 + 4);
    const mask = document.createElement('canvas');
    mask.width = cw;
    mask.height = ch;
    const mctx = mask.getContext('2d');
    mctx.font = fontCss;
    mctx.textAlign = 'center';
    mctx.textBaseline = 'middle';
    mctx.lineJoin = 'round';
    mctx.lineCap = 'round';
    mctx.lineWidth = pad * 2;
    mctx.strokeStyle = '#000';
    mctx.fillStyle = '#000';
    mctx.strokeText(text, cw / 2, ch / 2);
    mctx.fillText(text, cw / 2, ch / 2);
    return {
      path: null,
      mask,
      bounds: { w: cw, h: ch },
      center: { x: cw / 2, y: ch / 2 },
      type: 'glyphCutout',
      tear: 'straight',
      textOffset: { x: (cw - textWidth) / 2, y: (ch - textHeight) / 2 }
    };
  }

  // ── Standard shapes (rect / parallelogram) ──
  let padX, padY, shapeSafety;
  if (isPunct) {
    // Punctuation: slightly larger paper relative to glyph
    padX = textWidth * 0.45 + textHeight * 0.25;
    padY = textHeight * 0.5;
    shapeSafety = textHeight * 0.3;
  } else {
    padX = textWidth * 0.15 + textHeight * 0.15;
    padY = textHeight * 0.3;
    const isShaped = (shapeType === 'parallelogram');
    shapeSafety = isShaped ? textWidth * 0.30 + textHeight * 0.2 : textHeight * 0.15;
  }
  const baseW = textWidth + padX * 2 + shapeSafety;
  const baseH = textHeight + padY * 2 + shapeSafety * 0.5;

  const corners = buildCorners(shapeType, baseW, baseH, glyph, rng);
  const minX = Math.min(...corners.map(c => c.x));
  const minY = Math.min(...corners.map(c => c.y));
  const maxX = Math.max(...corners.map(c => c.x));
  const maxY = Math.max(...corners.map(c => c.y));
  const normCorners = corners.map(c => ({ x: c.x - minX, y: c.y - minY }));
  const boundsW = maxX - minX;
  const boundsH = maxY - minY;
  const cx = normCorners.reduce((s, c) => s + c.x, 0) / normCorners.length;
  const cy = normCorners.reduce((s, c) => s + c.y, 0) / normCorners.length;

  const charSize = Math.min(boundsW, boundsH);
  const path = applyTear(normCorners, tearKey, rng, charSize);

  return {
    path,
    bounds: { w: boundsW, h: boundsH },
    center: { x: cx, y: cy },
    type: shapeType,
    tear: tearKey,
    textOffset: { x: (boundsW - textWidth) / 2, y: (boundsH - textHeight) / 2 }
  };
}

/**
 * Pick a tear style key using seed rng.
 * Can be weakly correlated with shape (square → prefers straight/fine).
 */
export function pickTearStyle(rng, shapeType) {
  if (shapeType === 'glyphCutout') return 'straight';
  const roll = rng.range(0, 1);
  if (shapeType === 'rect' || shapeType === 'pentagon' || shapeType === 'hexagon') {
    if (roll < 0.15) return 'straight';
    if (roll < 0.45) return 'fine';
    if (roll < 0.80) return 'rough';
    return 'wavy';
  }
  // parallelogram: less straight
  if (roll < 0.08) return 'straight';
  if (roll < 0.30) return 'fine';
  if (roll < 0.75) return 'rough';
  return 'wavy';
}
