// palettes.js - Color palette management system
// 每套配色方案 3 组颜色：纸片底色(fills)、文字颜色(textColors)、描边颜色(strokeColors)

const PALETTES = [
  {
    id: 'vintage-mag-clash',
    name: '复古杂志撞色',
    fills: ['#F7C6D0', '#F4D35E', '#8EC5E8', '#E99A79', '#B8D986'],
    textColors: ['#202020', '#174A8B', '#C72C48'],
    strokeColors: ['#FFFFFF', '#35252C']
  },
  {
    id: 'candy-pink-blue',
    name: '糖果粉蓝',
    fills: ['#FFB3D1', '#F7D6E0', '#8ED8F8', '#B8B5FF', '#FFF0A8'],
    textColors: ['#D92772', '#1747A6', '#43265E'],
    strokeColors: ['#FFFFFF', '#282044']
  },
  {
    id: 'lemon-orange-soda',
    name: '柠檬橘子汽水',
    fills: ['#FFF176', '#FFC857', '#FF9B71', '#FFB7A5', '#B9E769'],
    textColors: ['#D93625', '#243B7A', '#242424'],
    strokeColors: ['#FFFFFF', '#572C27']
  },
  {
    id: 'cobalt-yellow',
    name: '钴蓝与亮黄',
    fills: ['#A8D8F0', '#F9E547', '#7CC8C0', '#F7B6CB', '#C5B7F2'],
    textColors: ['#1746A2', '#E63845', '#202020'],
    strokeColors: ['#FFFFFF', '#192B56']
  },
  {
    id: 'pop-art',
    name: '波普艺术红黄蓝',
    fills: ['#F04452', '#FFD84D', '#4DB6E5', '#F7A8C8', '#79C96B'],
    textColors: ['#171717', '#FFFFFF', '#172D70'],
    strokeColors: ['#202020', '#FFFFFF']
  },
  {
    id: 'sour-sweet-glucose',
    name: '酸甜葡萄糖',
    fills: ['#E7B5F5', '#FFB8D2', '#C7B8FF', '#F6D96B', '#A8E6CF'],
    textColors: ['#7129A6', '#D62978', '#252525'],
    strokeColors: ['#FFFFFF', '#46204E']
  },
  {
    id: 'strawberry-milk',
    name: '活力草莓牛奶',
    fills: ['#FFB4B4', '#F57D9B', '#FFE2A8', '#FFCEE5', '#B6E3D1'],
    textColors: ['#C51E46', '#7D245A', '#253A67'],
    strokeColors: ['#FFFFFF', '#4A2032']
  },
  {
    id: 'street-graffiti',
    name: '街头涂鸦',
    fills: ['#FF7A45', '#FFD447', '#58C4DD', '#D6F36A', '#F5A6D0'],
    textColors: ['#171717', '#1749B0', '#D51F35'],
    strokeColors: ['#FFFFFF', '#202020']
  },
  {
    id: 'sea-salt-mint',
    name: '清新海盐薄荷',
    fills: ['#A8E6CF', '#B5E7F5', '#D1F28A', '#FFF0A6', '#F7B8D0'],
    textColors: ['#176B68', '#2455A4', '#C53662'],
    strokeColors: ['#FFFFFF', '#25413E']
  },
  {
    id: 'retro-rock',
    name: '彩色复古摇滚',
    fills: ['#F3A6A6', '#E8C95A', '#83B9DB', '#B7CE73', '#D5A6CF'],
    textColors: ['#242424', '#C62838', '#253D78'],
    strokeColors: ['#FFFFFF', '#33252B']
  }
];

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
  const lin = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
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
 * 智能配色方案：用对比度筛选颜色，保证文字可读、描边有效。
 * @param {object} rng - RNG 实例（用于选方案）
 * @param {number} driftAmount - 0-1，颜色漂移幅度
 * @returns {object} { palette, getColors(posRng, prevColors) }
 */
export function createColorScheme(rng, driftAmount = 0) {
  const palette = rng.pick(PALETTES);

  return {
    palette,
    /**
     * 智能选色：底色 → 按对比度筛文字色 → 按对比度筛描边色
     * @param {object} posRng - 位置 RNG
     * @param {object|null} prevColors - 上一个字的颜色（用于避免相邻完全同色）
     * @returns {{fill:string, text:string, stroke:string}}
     */
    getColors(posRng, prevColors = null) {
      let fill, text, stroke;
      let bestCombo = null;
      let bestScore = -1;

      // 最多尝试 5 次，找到对比度合格的组合
      for (let attempt = 0; attempt < 5; attempt++) {
        // 第 1 步：随机选纸片底色
        fill = posRng.pick(palette.fills);
        if (driftAmount > 0) fill = driftColorWithRng(fill, posRng, driftAmount);

        // 第 2 步：从文字颜色中按对比度筛选
        const textCandidates = palette.textColors.map(c => ({
          hex: driftAmount > 0 ? driftColorWithRng(c, posRng, driftAmount) : c,
          contrast: 0
        }));
        for (const tc of textCandidates) tc.contrast = contrastRatio(fill, tc.hex);

        // 优先对比度 ≥ 4.5 的
        let qualified = textCandidates.filter(tc => tc.contrast >= 4.5);
        // 没有合格的，放宽到 ≥ 3.0
        if (qualified.length === 0) qualified = textCandidates.filter(tc => tc.contrast >= 3.0);
        // 仍然没有，选对比度最高的
        if (qualified.length === 0) {
          text = textCandidates.reduce((a, b) => a.contrast > b.contrast ? a : b).hex;
        } else {
          // 在合格的里随机选（不选最高，保留变化）
          text = posRng.pick(qualified).hex;
        }

        // 第 3 步：筛选描边颜色
        const strokeCandidates = palette.strokeColors.map(c => ({
          hex: c,
          vsText: contrastRatio(c, text),
          vsFill: contrastRatio(c, fill)
        }));

        // 描边需要和文字有区别(≥3) 且 和底色有区别(≥3)
        let qualifiedStrokes = strokeCandidates.filter(s => s.vsText >= 3 && s.vsFill >= 3);
        if (qualifiedStrokes.length === 0) {
          // 放宽：至少和文字或底色之一有 ≥3 区别
          qualifiedStrokes = strokeCandidates.filter(s => s.vsText >= 3 || s.vsFill >= 3);
        }
        if (qualifiedStrokes.length > 0) {
          stroke = posRng.pick(qualifiedStrokes).hex;
        } else {
          // 兜底：选 #171717 或 #FFFFFF 中对比度更好的
          const fallback1 = '#171717';
          const fallback2 = '#FFFFFF';
          const c1 = Math.max(contrastRatio(fallback1, text), contrastRatio(fallback1, fill));
          const c2 = Math.max(contrastRatio(fallback2, text), contrastRatio(fallback2, fill));
          stroke = c1 >= c2 ? fallback1 : fallback2;
        }

        // 计算综合得分（文字对比度 + 描边对比度的最小值）
        const score = Math.min(contrastRatio(fill, text),
          Math.min(contrastRatio(stroke, text), contrastRatio(stroke, fill)));

        // 如果文字对比度 ≥ 4.5 且描边对比度 ≥ 3，合格
        if (contrastRatio(fill, text) >= 4.5 && score >= 3) {
          // 检查是否和上一个字完全相同（避免相邻同色）
          if (prevColors && fill === prevColors.fill && text === prevColors.text && stroke === prevColors.stroke) {
            if (attempt < 4) continue; // 重试
          }
          return { fill, text, stroke };
        }

        // 记录最佳候选
        if (score > bestScore) {
          bestScore = score;
          bestCombo = { fill, text, stroke };
        }
      }

      // 5 次都没找到完美组合，用最佳候选
      return bestCombo || { fill, text: '#171717', stroke: '#FFFFFF' };
    }
  };
}

function driftColorWithRng(hex, rng, driftAmount) {
  const { h, s, l } = hexToHsl(hex);
  const hShift = rng.range(-15 * driftAmount, 15 * driftAmount);
  const sShift = rng.range(-10 * driftAmount, 10 * driftAmount);
  const lShift = rng.range(-8 * driftAmount, 8 * driftAmount);
  return hslToHex(
    Math.max(0, Math.min(360, h + hShift)),
    Math.max(0, Math.min(100, s + sShift)),
    Math.max(0, Math.min(100, l + lShift))
  );
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
