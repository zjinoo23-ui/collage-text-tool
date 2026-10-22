// palettes.js - Color palette system (v3)
// 规则：明亮复古纸片——浅色底片为主、深色文字、强调色少量点缀

import { createRng, hashString } from './rng.js';

const ALGORITHM_VERSION = 'collage-color-v3';

const PALETTES = [
  {
    id: 'retro-magazine',
    name: '复古杂志原色',
    fills: ['#FFF0A8', '#FFB7D5', '#A8DDF0', '#B8E6C5', '#FFC18C'],
    textColors: ['#171717', '#E63946', '#1769AA'],
    strokeColors: ['#FFF8E8', '#202020']
  },
  {
    id: 'vivid-pop',
    name: '鲜艳波普',
    fills: ['#FFE45E', '#FF9CCB', '#85D9F2', '#FFAD82', '#B9E86B'],
    textColors: ['#F12B64', '#242424', '#6A35C8'],
    strokeColors: ['#FFF9E9', '#202020']
  },
  {
    id: 'candy-print',
    name: '糖果印刷',
    fills: ['#FFC1DC', '#C4B7FF', '#A6E8F0', '#FFE18A', '#FFB99B'],
    textColors: ['#D92F78', '#183F83', '#F04D2D'],
    strokeColors: ['#FFF8E8', '#202020']
  },
  {
    id: 'classic-kids',
    name: '经典儿童杂志',
    fills: ['#FFF58A', '#FFCA72', '#FFB4C8', '#B9F0D0', '#A9E5F7'],
    textColors: ['#E83E36', '#193C79', '#187653'],
    strokeColors: ['#FFF9E9', '#202020']
  },
  {
    id: 'clash-poster',
    name: '撞色海报',
    fills: ['#C8F1E5', '#A9E4F5', '#FFF0A3', '#B7C9FF', '#FFD0B5'],
    textColors: ['#EA315B', '#292929', '#0E7892'],
    strokeColors: ['#FFF9E9', '#202020']
  },
  {
    id: 'retro-candy-wrap',
    name: '复古糖果包装',
    fills: ['#FFE6A1', '#F7B8C8', '#A9D6E8', '#C9E2A3', '#F5C18E'],
    textColors: ['#D52E3F', '#174F9B', '#6F3697'],
    strokeColors: ['#FFF8E8', '#202020']
  },
  {
    id: 'bright-juice',
    name: '明快果汁',
    fills: ['#FFD3A5', '#FFB5B0', '#D7E99B', '#A9E7D8', '#FFE991'],
    textColors: ['#F04B26', '#16664D', '#B72F73'],
    strokeColors: ['#FFF9E9', '#202020']
  },
  {
    id: 'print-lab',
    name: '彩色印刷实验室',
    fills: ['#FFD8ED', '#C7C0FF', '#A8E8FF', '#FFF09A', '#B8F1B0'],
    textColors: ['#EC287B', '#3D32A1', '#E64A27'],
    strokeColors: ['#FFF9E9', '#202020']
  }
];

// 五个色位的实际抽取权重（色位 1/2/5 柔和共 60%，色位 3 中彩度 25%，色位 4 强调 15%）
const POSITION_WEIGHTS = [0.20, 0.20, 0.25, 0.15, 0.20];
const ACCENT_POSITION = 3;

// 强调色密度限制
const GROUP_ACCENT_MAX = 1;     // 每个局部配色组最多 1 个强调色底片
const RECENT_WINDOW = 10;       // 任意连续 10 个可见字素
const RECENT_ACCENT_MAX = 2;    // 其中最多 2 个强调色底片

// 对比度阈值
const TEXT_AA = 4.5;
const TEXT_FALLBACK = 3.0;
const STROKE_VS_TEXT = 5.0;

// 固定漂移幅度（不跟随随机幅度滑块）
const DRIFT_H = 2.25;          // 色相 ±2.25°
const DRIFT_S = 1.5;           // 饱和度 ±1.5 个百分点
const DRIFT_L = 1.2;           // 明度 ±1.2 个百分点

// 兜底组合（不漂移）
const FALLBACK = { fill: '#F1E1BD', text: '#242321', stroke: '#FFF9F0' };

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

/**
 * 智能配色方案 v3
 * @param {number} seed - 全局种子
 * @returns {object} 配色方案实例
 */
export function createColorScheme(seed) {
  const colorSeed = hashString(`${seed}:${ALGORITHM_VERSION}`);

  // 局部配色组状态
  let currentGroup = -1;
  let accentInGroup = 0;
  // 最近可见字素是否为强调色（保留最近 9 个，用于连续 10 字上限）
  const recentAccents = [];

  function paletteForGroup(groupIndex) {
    const idx = hashString(`${colorSeed}:g${groupIndex}`) % PALETTES.length;
    return PALETTES[idx];
  }

  /** 按色位权重抽底色；不允许强调色时按 柔和60 : 中彩度25 重分配 */
  function pickFillIndex(rng, accentAllowed) {
    const weights = accentAllowed
      ? POSITION_WEIGHTS
      : POSITION_WEIGHTS.map((w, i) => i === ACCENT_POSITION ? 0 : w);
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = rng.next() * sum;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }

  /** 文字对比度阈值：该底色本身能达到 4.5 就要求 4.5，否则允许 3.0 */
  function textThresholdFor(palette, fill) {
    const maxK = palette.textColors.reduce((m, c) => Math.max(m, contrastRatio(fill, c)), 0);
    return maxK >= TEXT_AA ? TEXT_AA : TEXT_FALLBACK;
  }

  /** 选文字色：≥4.5 → ≥3.0 → 最高 */
  function pickText(palette, fill, rng) {
    const cands = palette.textColors.map(hex => ({ hex, k: contrastRatio(fill, hex) }));
    const threshold = textThresholdFor(palette, fill);
    let qualified = cands.filter(c => c.k >= threshold);
    if (qualified.length === 0) qualified = [cands.reduce((a, b) => a.k > b.k ? a : b)];
    return rng.pick(qualified).hex;
  }

  /**
   * 选描边色。返回 { hex, tier }：
   * 1 = 描边/文字 ≥5
   * 2 = 描边/文字 ≥3
   * 3 = 无符合项，取与文字对比度最高的一个
   *
   * 注：v3 同时要求「描边/底色 ≥3」，但浅底深字时两个条件数学上无解
   * （纸白描边与浅底几乎同色，深色描边与深字几乎同色）。
   * 按此前确认的取舍：优先保证描边不与文字糊在一起。
   */
  function pickStroke(palette, fill, text, rng) {
    const cands = palette.strokeColors.map(hex => ({
      hex,
      vsText: contrastRatio(hex, text)
    }));
    const tiers = [
      c => c.vsText >= STROKE_VS_TEXT,
      c => c.vsText >= TEXT_FALLBACK
    ];
    for (let i = 0; i < tiers.length; i++) {
      const qualified = cands.filter(tiers[i]);
      if (qualified.length > 0) return { hex: rng.pick(qualified).hex, tier: i + 1 };
    }
    const best = cands.reduce((a, b) => a.vsText > b.vsText ? a : b);
    return { hex: best.hex, tier: 3 };
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

  /** 检查组合是否仍处于原本档位 */
  function meetsTier(fill, text, stroke, tier, textThreshold) {
    if (contrastRatio(fill, text) < textThreshold) return false;
    const vsText = contrastRatio(stroke, text);
    if (tier === 1) return vsText >= STROKE_VS_TEXT;
    if (tier === 2) return vsText >= TEXT_FALLBACK;
    return true; // 档位 3 本身就是无解时的折中，不做硬性约束
  }

  function sameColors(a, b) {
    return a && b && a.fill === b.fill && a.text === b.text && a.stroke === b.stroke;
  }

  /** 8 次仍失败：取该调色板中文字/底色对比度最高的组合 */
  function bestCombo(palette) {
    let best = null;
    for (const fill of palette.fills) {
      for (const text of palette.textColors) {
        const k = contrastRatio(fill, text);
        if (!best || k > best.k) best = { fill, text, k };
      }
    }
    if (best.k < TEXT_FALLBACK) return { ...FALLBACK };
    const { hex: stroke } = pickStroke(palette, best.fill, best.text, createRng(hashString(`${colorSeed}:best`)));
    return { fill: best.fill, text: best.text, stroke };
  }

  /** 抽一个纸片配色 */
  function sample(visibleIndex, prevVisible, seedTag, applyConstraints, accentAllowed) {
    const groupIndex = Math.floor(visibleIndex / 4);
    const palette = paletteForGroup(groupIndex);
    const pieceSeed = hashString(`${colorSeed}:${visibleIndex * 997}${seedTag}`);

    for (let attempt = 0; attempt < 8; attempt++) {
      const stream = suffix => createRng(hashString(`${pieceSeed}:${suffix}:${attempt}`));

      const fillIdx = pickFillIndex(stream('fill'), accentAllowed);
      const fill = palette.fills[fillIdx];
      const text = pickText(palette, fill, stream('text'));
      const strokePick = pickStroke(palette, fill, text, stream('stroke'));
      const textThreshold = textThresholdFor(palette, fill);

      // 漂移（三色独立子流）
      const drifted = {
        fill: drift(fill, stream('drift-fill')),
        text: drift(text, stream('drift-text')),
        stroke: drift(strokePick.hex, stream('drift-stroke'))
      };

      // 漂移后若跌出原档位，依次撤销颜色漂移
      let resolved = null;
      if (meetsTier(drifted.fill, drifted.text, drifted.stroke, strokePick.tier, textThreshold)) {
        resolved = drifted;
      } else {
        const reverts = [
          { ...drifted, fill },                 // 撤销底色漂移
          { ...drifted, text },                 // 撤销文字漂移
          { ...drifted, stroke: strokePick.hex },// 撤销描边漂移
          { fill, text, stroke: strokePick.hex } // 全部撤销
        ];
        resolved = reverts.find(c => meetsTier(c.fill, c.text, c.stroke, strokePick.tier, textThreshold)) || null;
      }
      if (!resolved) continue;

      // 相邻去重：只比较前一个可见字素
      if (applyConstraints && prevVisible && sameColors(resolved, prevVisible) && attempt < 7) {
        continue;
      }

      return { ...resolved, accent: fillIdx === ACCENT_POSITION };
    }

    return { ...bestCombo(palette), accent: false };
  }

  return {
    colorSeed,

    /** 可见字素纸片的配色 */
    getPieceColors(visibleIndex, prevVisible = null) {
      const groupIndex = Math.floor(visibleIndex / 4);
      if (groupIndex !== currentGroup) {
        currentGroup = groupIndex;
        accentInGroup = 0;
      }
      const recentAccentCount = recentAccents.reduce((n, b) => n + (b ? 1 : 0), 0);
      const accentAllowed = accentInGroup < GROUP_ACCENT_MAX &&
        recentAccentCount < RECENT_ACCENT_MAX;

      const colors = sample(visibleIndex, prevVisible, '', true, accentAllowed);
      if (colors.accent) accentInGroup++;
      recentAccents.push(colors.accent);
      if (recentAccents.length > RECENT_WINDOW - 1) recentAccents.shift();

      const { accent, ...out } = colors;
      return out;
    },

    /**
     * 标点纸片的配色：当前组 + 当前序号，
     * 不推进序号、不参与相邻去重、不影响强调色窗口统计。
     */
    getMarkColors(visibleIndex) {
      const { accent, ...out } = sample(visibleIndex, null, ':mark', false, true);
      return out;
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
