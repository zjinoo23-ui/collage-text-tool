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

/**
 * Pick a palette and assign colors using rng.
 * @param {object} rng - RNG instance
 * @param {number} driftAmount - 0-1, amount of color drift
 * @returns {object} { palette, getFill, getText, getStroke }
 */
export function createColorScheme(rng, driftAmount = 0) {
  const palette = rng.pick(PALETTES);

  return {
    palette,
    getFill(positionRng) {
      const base = positionRng.pick(palette.fills);
      return driftAmount > 0 ? driftColorWithRng(base, positionRng, driftAmount) : base;
    },
    getText(positionRng) {
      const base = positionRng.pick(palette.textColors);
      return driftAmount > 0 ? driftColorWithRng(base, positionRng, driftAmount) : base;
    },
    getStroke(positionRng) {
      return positionRng.pick(palette.strokeColors);
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
