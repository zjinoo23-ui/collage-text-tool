// palettes.js - Color palette system (v2)
// 规则：柔和纸片为主、鲜亮色点缀、深色文字稳定画面
// 每套配色 3 组颜色：纸片底色(fills)、文字颜色(textColors)、描边颜色(strokeColors)

import { createRng, hashString } from './rng.js';

const ALGORITHM_VERSION = 'collage-color-v2';

const PALETTES = [
  {
    id: 'old-magazine-pink-yellow-blue',
    name: '旧杂志粉黄蓝',
    fills: ['#E7B7B8', '#E8D59C', '#A8B9C7', '#C87961', '#A9B69A'],
    textColors: ['#242321', '#34495A', '#783E3B'],
    strokeColors: ['#F8F2E7', '#302B2A']
  },
  {
    id: 'cream-pink-dark-red',
    name: '奶油粉与暗红',
    fills: ['#E8B8C0', '#F0D8C8', '#D5C1B4', '#B86B68', '#AEB9AE'],
    textColors: ['#282423', '#713E45', '#3E5653'],
    strokeColors: ['#FBF5EC', '#30292A']
  },
  {
    id: 'mustard-ink-green',
    name: '芥末黄与墨绿',
    fills: ['#D9BF68', '#E8D9B7', '#AEBB9D', '#809C8D', '#C9896C'],
    textColors: ['#252724', '#344E42', '#57433A'],
    strokeColors: ['#F8F1E4', '#26302C']
  },
  {
    id: 'gray-blue-brick-red',
    name: '灰蓝与砖红',
    fills: ['#9FB3C1', '#D8D0C4', '#BD7266', '#E2C98B', '#ABB5A6'],
    textColors: ['#24272A', '#34495D', '#6F3733'],
    strokeColors: ['#F7F2E9', '#2D3030']
  },
  {
    id: 'dusty-pink-grape',
    name: '暗粉与葡萄紫',
    fills: ['#D7A6AD', '#E6D5BE', '#AFA6B5', '#C58B76', '#9DAE9D'],
    textColors: ['#282427', '#51415D', '#74434A'],
    strokeColors: ['#FBF4E9', '#302A30']
  },
  {
    id: 'retro-teal-orange',
    name: '复古青绿与橙',
    fills: ['#78A69B', '#E2C48A', '#D28B6F', '#D7C9B7', '#A9B6A6'],
    textColors: ['#252827', '#294C48', '#684235'],
    strokeColors: ['#F8F1E6', '#28302E']
  },
  {
    id: 'faded-red-blue',
    name: '褪色红蓝',
    fills: ['#C97A74', '#8EA5B4', '#E5D1AE', '#D7B4A6', '#B7B8A4'],
    textColors: ['#272523', '#35485B', '#633A36'],
    strokeColors: ['#FAF3E7', '#302D2A']
  },
  {
    id: 'warm-brown-sea-salt',
    name: '暖棕与海盐蓝',
    fills: ['#C98B68', '#E5D5BD', '#9CB8C2', '#B9B39A', '#D5AAA0'],
    textColors: ['#262522', '#344C57', '#654337'],
    strokeColors: ['#FAF3E8', '#302B28']
  },
  {
    id: 'paper-mint-rose',
    name: '旧纸薄荷与玫瑰',
    fills: ['#A9C5B2', '#E7D9B7', '#D7A0A7', '#A9BBC1', '#C8896A'],
    textColors: ['#242725', '#36514A', '#773E4A'],
    strokeColors: ['#F9F4E9', '#2A302D']
  },
  {
    id: 'retro-rock-accent',
    name: '复古摇滚点缀',
    fills: ['#C76B62', '#D5B84F', '#66869B', '#78866A', '#B68A9C'],
    textColors: ['#201F20', '#F5EBDD', '#283B54'],
    strokeColors: ['#F8F1E6', '#292626']
  }
];

// 色位分类：0/1/4 = 柔和纸色，2 = 中彩度，3 = 强调色
const CATEGORIES = [
  { indices: [0, 1, 4], weight: 0.60 },
  { indices: [2], weight: 0.25 },
  { indices: [3], weight: 0.15 }
];

// 底色约束
const MIN_FILL_L = 0.35;       // 明度低于该值不作为底色
const BRIGHT_SAT = 0.65;       // HSL 饱和度高于该值视为鲜亮色
const BRIGHT_WINDOW = 10;      // 连续 10 个字内鲜亮底色最多 1 次
const HUE_WINDOW = 5;          // 连续 5 个字内
const HUE_MAX_COUNT = 2;       // 同一色相区间最多 2 次
const HUE_TOLERANCE = 18;      // 色相相差小于 18° 视为同一区间
const HUE_MIN_SAT = 0.12;      // 饱和度太低的颜色不参与色相聚类

// 对比度阈值
// 注：规范中「描边/底色 ≥3」与「描边/文字 ≥5」在浅底深字时数学上无法同时满足
// （每套只有纸白 + 深色两个描边色），故只保留「描边/文字 ≥5」，保证描边不与文字糊在一起
const TEXT_AA = 4.5;
const TEXT_FALLBACK = 3.0;
const STROKE_VS_TEXT = 5.0;

// 固定漂移幅度（不跟随随机幅度滑块）
const DRIFT_H = 2.25;          // 色相 ±2.25°
const DRIFT_S = 1.5;           // 饱和度 ±1.5 个百分点
const DRIFT_L = 1.2;           // 明度 ±1.2 个百分点

// 兜底组合（不漂移）
const FALLBACK = { fill: '#E8D9B7', text: '#242321', stroke: '#F8F2E7' };

/** Get all palettes */
export function getPalettes() {
  return PALETTES;
}

/** Get palette by id */
export function getPaletteById(id) {
  return PALETTES.find(p => p.id === id);
}

// ── WCAG 对比度计算（带缓存）──
const _luminanceCache = new Map();

/** 计算颜色的相对亮度（WCAG 2.1 标准） */
function relativeLuminance(hex) {
  if (_luminanceCache.has(hex)) return _luminanceCache.get(hex);
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  _luminanceCache.set(hex, L);
  return L;
}

/** 计算两个颜色之间的对比度（1-21） */
function contrastRatio(hex1, hex2) {
  const L1 = relativeLuminance(hex1);
  const L2 = relativeLuminance(hex2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** HSL（h 0-360, s/l 0-1） */
function hslUnit(hex) {
  const { h, s, l } = hexToHsl(hex);
  return { h, s: s / 100, l: l / 100 };
}

/** 色相环距离 */
function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

/**
 * 智能配色方案 v2
 * @param {number} seed - 全局种子
 * @returns {object} 配色方案实例
 */
export function createColorScheme(seed) {
  const colorSeed = hashString(`${seed}:${ALGORITHM_VERSION}`);
  // 最近可见字素的底色记录（用于鲜亮色 / 色相窗口约束）
  const recentFills = [];

  function paletteForGroup(groupIndex) {
    const idx = hashString(`${colorSeed}:g${groupIndex}`) % PALETTES.length;
    return PALETTES[idx];
  }

  /** 按类别权重抽一个底色 */
  function pickWeightedFill(palette, rng) {
    const r = rng.next();
    let acc = 0;
    let cat = CATEGORIES[CATEGORIES.length - 1];
    for (const c of CATEGORIES) {
      acc += c.weight;
      if (r < acc) { cat = c; break; }
    }
    return palette.fills[cat.indices[rng.int(0, cat.indices.length - 1)]];
  }

  /** 底色是否满足明度 / 鲜亮 / 色相窗口约束 */
  function acceptFill(hex) {
    const { h, s, l } = hslUnit(hex);
    if (l < MIN_FILL_L) return false;

    // 连续 10 个字内鲜亮底色最多 1 次
    const brightNow = s > BRIGHT_SAT;
    if (brightNow && recentFills.slice(-(BRIGHT_WINDOW - 1)).some(f => f.bright)) return false;

    // 连续 5 个字内同一色相区间最多 2 次
    if (s >= HUE_MIN_SAT) {
      const near = recentFills.slice(-(HUE_WINDOW - 1))
        .filter(f => f.sat >= HUE_MIN_SAT && hueDistance(f.hue, h) < HUE_TOLERANCE);
      if (near.length >= HUE_MAX_COUNT) return false;
    }
    return true;
  }

  /** 选底色（最多尝试 8 次，失败则退回柔和纸色） */
  function pickFill(palette, pieceSeed, attempt) {
    for (let k = 0; k < 8; k++) {
      const rng = createRng(hashString(`${pieceSeed}:fill:${attempt}:${k}`));
      const hex = pickWeightedFill(palette, rng);
      if (acceptFill(hex)) return hex;
    }
    // 兜底：从柔和纸色中选一个满足明度的
    for (const i of CATEGORIES[0].indices) {
      const hex = palette.fills[i];
      if (hslUnit(hex).l >= MIN_FILL_L) return hex;
    }
    return palette.fills[0];
  }

  /** 选文字色：优先 AA(4.5)，其次 3.0，再次最高对比度 */
  function pickText(palette, fill, rng) {
    const cands = palette.textColors.map(hex => ({ hex, k: contrastRatio(fill, hex) }));
    const maxK = cands.reduce((m, c) => Math.max(m, c.k), 0);
    const threshold = maxK >= TEXT_AA ? TEXT_AA : TEXT_FALLBACK;
    let qualified = cands.filter(c => c.k >= threshold);
    if (qualified.length === 0) qualified = [cands.reduce((a, b) => a.k > b.k ? a : b)];
    return rng.pick(qualified).hex;
  }

  /** 选描边色：优先保证与文字对比度 ≥5，避免描边和字糊在一起 */
  function pickStroke(palette, text, rng) {
    const cands = palette.strokeColors.map(hex => ({
      hex,
      vsText: contrastRatio(hex, text)
    }));
    const tiers = [
      c => c.vsText >= STROKE_VS_TEXT,
      c => c.vsText >= TEXT_FALLBACK
    ];
    for (const tier of tiers) {
      const qualified = cands.filter(tier);
      if (qualified.length > 0) return rng.pick(qualified).hex;
    }
    return cands.reduce((a, b) => a.vsText > b.vsText ? a : b).hex;
  }

  /** 固定幅度漂移 */
  function drift(hex, rng) {
    const { h, s, l } = hexToHsl(hex);
    return hslToHex(
      (h + rng.range(-DRIFT_H, DRIFT_H) + 360) % 360,
      Math.max(0, Math.min(100, s + rng.range(-DRIFT_S, DRIFT_S))),
      Math.max(0, Math.min(100, l + rng.range(-DRIFT_L, DRIFT_L)))
    );
  }

  /** 文字对比度阈值：该底色本身能达到 4.5 就要求 4.5，否则允许 3.0 降级 */
  function textThresholdFor(palette, fill) {
    const maxK = palette.textColors.reduce((m, c) => Math.max(m, contrastRatio(fill, c)), 0);
    return maxK >= TEXT_AA ? TEXT_AA : TEXT_FALLBACK;
  }

  /** 复检：文字/底色、描边/文字 */
  function passes(palette, fill, text, stroke) {
    return contrastRatio(fill, text) >= textThresholdFor(palette, fill) &&
      contrastRatio(stroke, text) >= STROKE_VS_TEXT;
  }

  function sameColors(a, b) {
    return a && b && a.fill === b.fill && a.text === b.text && a.stroke === b.stroke;
  }

  /**
   * 抽一个纸片的配色。
   * @param {number} visibleIndex - 可见字素序号（标点/空格不占序号）
   * @param {{fill,text,stroke}|null} prevVisible - 上一个可见字素的配色
   * @param {string} seedTag - 随机流后缀（标点用 ':mark' 区分）
   * @param {boolean} applyConstraints - 是否参与窗口约束 / 相邻去重 / 记录窗口
   */
  function sample(visibleIndex, prevVisible, seedTag, applyConstraints) {
    const groupIndex = Math.floor(visibleIndex / 4);
    const palette = paletteForGroup(groupIndex);
    const pieceSeed = hashString(`${colorSeed}:${visibleIndex * 997}${seedTag}`);

    for (let attempt = 0; attempt < 8; attempt++) {
      const stream = suffix => createRng(hashString(`${pieceSeed}:${suffix}:${attempt}`));

      const fill = pickFill(palette, pieceSeed, attempt);
      const text = pickText(palette, fill, stream('text'));
      const stroke = pickStroke(palette, text, stream('stroke'));

      // 漂移（三色各自独立子流）
      const drifted = {
        fill: drift(fill, stream('drift-fill')),
        text: drift(text, stream('drift-text')),
        stroke: drift(stroke, stream('drift-stroke'))
      };

      // 复检：不合格时撤销导致失败的颜色漂移
      let resolved = null;
      if (passes(palette, drifted.fill, drifted.text, drifted.stroke)) {
        resolved = drifted;
      } else {
        const reverts = [
          { ...drifted, fill },                 // 撤销底色漂移
          { ...drifted, text },                 // 撤销文字漂移
          { ...drifted, stroke },               // 撤销描边漂移
          { fill, text, stroke }                // 全部撤销
        ];
        resolved = reverts.find(c => passes(palette, c.fill, c.text, c.stroke)) || null;
      }
      if (!resolved) continue;

      // 相邻去重：只比较前一个可见字素（标点不参与）
      if (applyConstraints && prevVisible && sameColors(resolved, prevVisible) && attempt < 7) {
        continue;
      }

      if (applyConstraints) {
        const { h, s } = hslUnit(resolved.fill);
        recentFills.push({ hue: h, sat: s, bright: s > BRIGHT_SAT });
        if (recentFills.length > BRIGHT_WINDOW) recentFills.shift();
      }
      return resolved;
    }

    // 8 次仍失败：兜底组合（不漂移）
    if (applyConstraints) {
      const { h, s } = hslUnit(FALLBACK.fill);
      recentFills.push({ hue: h, sat: s, bright: false });
      if (recentFills.length > BRIGHT_WINDOW) recentFills.shift();
    }
    return { ...FALLBACK };
  }

  return {
    colorSeed,

    /**
     * 可见字素纸片的配色。
     * @param {number} visibleIndex - 可见字素序号
     * @param {{fill,text,stroke}|null} prevVisible - 上一个可见字素的配色
     */
    getPieceColors(visibleIndex, prevVisible = null) {
      return sample(visibleIndex, prevVisible, '', true);
    },

    /**
     * 标点纸片的配色：用当前组的调色板 + 当前字素序号，
     * 不推进序号、不参与相邻去重、不影响窗口统计。
     */
    getMarkColors(visibleIndex) {
      return sample(visibleIndex, null, ':mark', false);
    }
  };
}

// Color conversion utilities
export function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = x => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}
