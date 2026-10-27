// palettes.js - Color palette system (v3)
// 规则：复古纸片——旧纸底色为主、深色文字、少量强调色点缀

import { createRng, hashString } from './rng.js';

const ALGORITHM_VERSION = 'collage-color-v3';

const PALETTES = [
  {
    id: 'newsprint',
    name: '晨报新闻纸',
    fills: ['#F0E6CF', '#E5DAC0', '#D28E72', '#BF5158', '#A8B8A6'],
    textColors: ['#26261F', '#F7F1E0', '#9E3B42'],
    strokeColors: ['#FFF8EA', '#3A342C'],
    jumpTextColors: ['#2F6FA3', '#C65D2E']
  },
  {
    id: 'faded-poster',
    name: '褪色海报',
    fills: ['#EFE3C8', '#E7CF9A', '#D9B45E', '#B04A33', '#A39A6C'],
    textColors: ['#29251E', '#F8F1DF', '#8C3B2A'],
    strokeColors: ['#FDF6E6', '#3E352B'],
    jumpTextColors: ['#2F6FA3', '#C23A32']
  },
  {
    id: 'aged-magazine',
    name: '旧杂志',
    fills: ['#EDE2CE', '#E6B9A8', '#9AAEC0', '#AD5A5E', '#A6B2A0'],
    textColors: ['#262422', '#F6EFE2', '#7E4849'],
    strokeColors: ['#FBF5E8', '#373430'],
    jumpTextColors: ['#C14A32', '#3E7D3E']
  },
  {
    id: 'paper-trove',
    name: '纸堆',
    fills: ['#EBDCC0', '#F2E7CD', '#CB8B66', '#5A4438', '#A9B8A4'],
    textColors: ['#26211C', '#F5ECDA', '#B0644A'],
    strokeColors: ['#FBF3E0', '#3A2F27'],
    jumpTextColors: ['#2F6FA3', '#C65D2E']
  },
  {
    id: 'worn-books',
    name: '旧书',
    fills: ['#EFE3C4', '#E7DCC3', '#A84A3E', '#3E4A5E', '#A29A6B'],
    textColors: ['#232323', '#F2EAD8', '#7E4A41'],
    strokeColors: ['#F9F2E1', '#2E2B28'],
    jumpTextColors: ['#C65D2E', '#2E8B4F']
  },
  {
    id: 'garage-sale',
    name: '旧货摊',
    fills: ['#EFE5CE', '#E2D4B4', '#C75F4C', '#D9B569', '#9FB6AE'],
    textColors: ['#2A2620', '#F7F0DF', '#A0493C'],
    strokeColors: ['#FCF5E6', '#37322A'],
    jumpTextColors: ['#2F6FA3', '#3E7D3E']
  },
  {
    id: 'library-cards',
    name: '档案卡',
    fills: ['#F0E8D4', '#E4DAC2', '#BD6457', '#4A3F36', '#8FA5B4'],
    textColors: ['#252525', '#F4EEDF', '#95534A'],
    strokeColors: ['#FAF4E5', '#35302A'],
    jumpTextColors: ['#C65D2E', '#2E8B4F']
  },
  {
    id: 'field-notes',
    name: '野外笔记',
    fills: ['#EDE2C8', '#E6D9B6', '#94A466', '#3E4A3A', '#AD4E3E'],
    textColors: ['#25231E', '#F4EDDB', '#8A4638'],
    strokeColors: ['#F9F2E2', '#33302A'],
    jumpTextColors: ['#C65D2E', '#2F6FA3']
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

// 文字色策略参数
const INK_BLACK_RULE = l => l <= 20;      // 明度 ≤ 20% 视为"墨黑"
const INK_BLACK_WHEN_BRIGHT = 0.6;       // 浅纸时墨黑概率 60%
const GROUP_COLORED_TEXT_MAX = 1;         // 每组彩色字母上限
const JUMP_VS_REGULAR_IN_COLORED = 0.3;   // 彩色桶内跳色 30% / 常规彩 70%
const RECENT_JUMP_WINDOW = 15;            // 连续 15 字素的滑窗
const RECENT_JUMP_MAX = 1;                // 其中跳色字 ≤1

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
  let coloredTextInGroup = 0;         // 本组内已出现的彩色字母数
  // 滑窗状态
  const recentAccents = [];           // 保留最近 9 个，用于连续 10 字强调色上限
  const recentJumps = [];             // 保留最近 14 个，用于连续 15 字跳色上限

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

  /**
   * 判断一个文字色是否属于"墨黑"桶：明度 ≤ 20%。
   * 墨黑桶 + 彩色桶 覆盖所有候选，且两桶互斥。
   */
  function classifyTextBucket(hex) {
    const { l } = hexToHsl(hex);
    return INK_BLACK_RULE(l) ? 'ink' : 'colored';
  }

  /**
   * 选文字色：
   * - 浅纸（能达到 4.5 档）：
   *   ≥4.5 候选里，按 60% 概率挑墨黑，40% 挑彩色（后者要求 ≥3.0）。
   *   组内彩色字母已达上限时，强制墨黑桶。
   *   彩色通路内再分 30% 跳色 / 70% 常规彩。跳色从 palette.jumpTextColors 里挑，
   *   且对当前底色 ≥3.0；不可用时自动退回常规彩。
   *   跳色滑窗约束（15 字内 ≤1）不满足时，跳过跳色通路。
   *   仅在浅纸彩色通路主动挑出"彩色"时返回 colored=true；
   *   仅在浅纸彩色通路主动挑出"跳色"时返回 jump=true。
   * - 深色纸（只能到 3.0 档）：保持旧降级逻辑，不做彩色/跳色分流，
   *   返回 colored=false, jump=false。
   */
  function pickText(palette, fill, rng, coloredAllowed, jumpAllowed) {
    const cands = palette.textColors.map(hex => ({
      hex,
      k: contrastRatio(fill, hex),
      bucket: classifyTextBucket(hex)
    }));
    const threshold = textThresholdFor(palette, fill);

    if (threshold === TEXT_AA) {
      // 浅纸：进入墨黑 vs 彩色分流
      const inkPool = cands.filter(c => c.k >= threshold && c.bucket === 'ink');
      const coloredPool = cands.filter(c => c.k >= TEXT_FALLBACK && c.bucket === 'colored');

      // 组内彩色字母已满 → 强制墨黑（跳色也被连带禁止）
      if (!coloredAllowed) {
        if (inkPool.length > 0) return { hex: rng.pick(inkPool).hex, colored: false, jump: false };
        if (coloredPool.length > 0) return { hex: rng.pick(coloredPool).hex, colored: false, jump: false };
        const best = cands.reduce((a, b) => a.k > b.k ? a : b);
        return { hex: best.hex, colored: false, jump: false };
      }

      if (rng.next() < INK_BLACK_WHEN_BRIGHT) {
        // 墨黑通路
        if (inkPool.length > 0) return { hex: rng.pick(inkPool).hex, colored: false, jump: false };
        if (coloredPool.length > 0) return { hex: rng.pick(coloredPool).hex, colored: false, jump: false };
        const best = cands.reduce((a, b) => a.k > b.k ? a : b);
        return { hex: best.hex, colored: false, jump: false };
      } else {
        // 彩色通路：再分 跳色 30% / 常规彩 70%
        const jumpCand = (palette.jumpTextColors || [])
          .map(hex => ({ hex, k: contrastRatio(fill, hex) }))
          .filter(c => c.k >= TEXT_FALLBACK);
        const regularCand = coloredPool;

        if (jumpAllowed && jumpCand.length > 0 && rng.next() < JUMP_VS_REGULAR_IN_COLORED) {
          return { hex: rng.pick(jumpCand).hex, colored: true, jump: true };
        }
        if (regularCand.length > 0) return { hex: rng.pick(regularCand).hex, colored: true, jump: false };
        if (jumpCand.length > 0) return { hex: rng.pick(jumpCand).hex, colored: true, jump: true };
        if (inkPool.length > 0) return { hex: rng.pick(inkPool).hex, colored: false, jump: false };
        const best = cands.reduce((a, b) => a.k > b.k ? a : b);
        return { hex: best.hex, colored: best.bucket !== 'ink', jump: false };
      }
    }

    // 深色纸：保持降级逻辑，不做彩色/跳色分流
    let qualified = cands.filter(c => c.k >= threshold);
    if (qualified.length === 0) qualified = [cands.reduce((a, b) => a.k > b.k ? a : b)];
    return { hex: rng.pick(qualified).hex, colored: false, jump: false };
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
    if (best.k < TEXT_FALLBACK) return { ...FALLBACK, colored: false, jump: false };
    const { hex: stroke } = pickStroke(palette, best.fill, best.text, createRng(hashString(`${colorSeed}:best`)));
    return { fill: best.fill, text: best.text, stroke, colored: false, jump: false };
  }

  /** 抽一个纸片配色 */
  function sample(visibleIndex, prevVisible, seedTag, applyConstraints, accentAllowed, coloredAllowed, jumpAllowed) {
    const groupIndex = Math.floor(visibleIndex / 4);
    const palette = paletteForGroup(groupIndex);
    const pieceSeed = hashString(`${colorSeed}:${visibleIndex * 997}${seedTag}`);

    for (let attempt = 0; attempt < 8; attempt++) {
      const stream = suffix => createRng(hashString(`${pieceSeed}:${suffix}:${attempt}`));

      const fillIdx = pickFillIndex(stream('fill'), accentAllowed);
      const fill = palette.fills[fillIdx];
      const textPick = pickText(palette, fill, stream('text'), coloredAllowed, jumpAllowed);
      const strokePick = pickStroke(palette, fill, textPick.hex, stream('stroke'));
      const textThreshold = textThresholdFor(palette, fill);
      // 彩色字/跳色字不要求墨黑级的 4.5，放宽到 3.0
      const effectiveThreshold = (textPick.colored || textPick.jump) ? TEXT_FALLBACK : textThreshold;

      // 漂移（三色独立子流）
      const drifted = {
        fill: drift(fill, stream('drift-fill')),
        text: drift(textPick.hex, stream('drift-text')),
        stroke: drift(strokePick.hex, stream('drift-stroke'))
      };

      // 漂移后若跌出原档位，依次撤销颜色漂移
      let resolved = null;
      if (meetsTier(drifted.fill, drifted.text, drifted.stroke, strokePick.tier, effectiveThreshold)) {
        resolved = drifted;
      } else {
        const reverts = [
          { ...drifted, fill },                          // 撤销底色漂移
          { ...drifted, text: textPick.hex },            // 撤销文字漂移
          { ...drifted, stroke: strokePick.hex },        // 撤销描边漂移
          { fill, text: textPick.hex, stroke: strokePick.hex } // 全部撤销
        ];
        resolved = reverts.find(c => meetsTier(c.fill, c.text, c.stroke, strokePick.tier, effectiveThreshold)) || null;
      }
      if (!resolved) continue;

      // 相邻去重：只比较前一个可见字素
      if (applyConstraints && prevVisible && sameColors(resolved, prevVisible) && attempt < 7) {
        continue;
      }

      return { ...resolved, accent: fillIdx === ACCENT_POSITION, colored: textPick.colored, jump: textPick.jump };
    }

    return { ...bestCombo(palette), accent: false, colored: false, jump: false };
  }

  return {
    colorSeed,

    /** 可见字素纸片的配色 */
    getPieceColors(visibleIndex, prevVisible = null) {
      const groupIndex = Math.floor(visibleIndex / 4);
      if (groupIndex !== currentGroup) {
        currentGroup = groupIndex;
        accentInGroup = 0;
        coloredTextInGroup = 0;
      }
      const recentAccentCount = recentAccents.reduce((n, b) => n + (b ? 1 : 0), 0);
      const accentAllowed = accentInGroup < GROUP_ACCENT_MAX &&
        recentAccentCount < RECENT_ACCENT_MAX;
      const coloredAllowed = coloredTextInGroup < GROUP_COLORED_TEXT_MAX;
      const recentJumpCount = recentJumps.reduce((n, b) => n + (b ? 1 : 0), 0);
      const jumpAllowed = recentJumpCount < RECENT_JUMP_MAX;

      const colors = sample(visibleIndex, prevVisible, '', true, accentAllowed, coloredAllowed, jumpAllowed);
      if (colors.accent) accentInGroup++;
      recentAccents.push(colors.accent);
      if (colors.colored) coloredTextInGroup++;
      recentJumps.push(colors.jump);
      if (recentAccents.length > RECENT_WINDOW - 1) recentAccents.shift();
      if (recentJumps.length > RECENT_JUMP_WINDOW - 1) recentJumps.shift();

      const { accent, colored, jump, ...out } = colors;
      return out;
    },

    /**
     * 标点纸片的配色：当前组 + 当前序号，
     * 不推进序号、不参与相邻去重、不影响强调色窗口统计和彩色字母配额、不影响跳色窗口。
     */
    getMarkColors(visibleIndex) {
      const { accent, colored, jump, ...out } = sample(visibleIndex, null, ':mark', false, true, true, true);
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
