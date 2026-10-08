// palettes.js - Color palette management system
// 每套配色方案 3 组颜色：纸片底色(fills)、文字颜色(textColors)、描边颜色(strokeColors)

const PALETTES = [
  {
    id: 'vintage-cream',
    name: '复古奶油',
    fills: ['#FFF8E7', '#F5E6C8', '#E8D5B0', '#D4C4A8', '#F0DFC0'],
    textColors: ['#8B7355', '#6B5344', '#5A4A3A'],
    strokeColors: ['#4A3F35', '#3A2F25']
  },
  {
    id: 'morandi-pink',
    name: '莫兰迪灰粉',
    fills: ['#F5E6E0', '#E8D5D0', '#DCC8C4', '#F0E0DC', '#E5D0CC'],
    textColors: ['#7A5F5C', '#5C4F4C', '#684A4A'],
    strokeColors: ['#443838', '#332D2D']
  },
  {
    id: 'fresh-mint',
    name: '清新薄荷',
    fills: ['#EAF7F0', '#D8EFE5', '#C5E4D7', '#E0F2E8', '#BBDACD'],
    textColors: ['#39705C', '#285746', '#32664F'],
    strokeColors: ['#204438', '#17352C']
  },
  {
    id: 'cream-lemon',
    name: '奶油柠檬',
    fills: ['#FFFBE6', '#F8F1C8', '#EFE5A8', '#F5EBC5', '#E5D99A'],
    textColors: ['#85752E', '#66591F', '#584D22'],
    strokeColors: ['#403916', '#302C12']
  },
  {
    id: 'vintage-brick',
    name: '复古砖红',
    fills: ['#F8E8DF', '#EFD5CA', '#E5C1B5', '#F2DDD4', '#DDB8AC'],
    textColors: ['#984F45', '#773D37', '#63332F'],
    strokeColors: ['#4A2926', '#35201E']
  },
  {
    id: 'haze-blue-gray',
    name: '雾霾蓝灰',
    fills: ['#E8F0F3', '#D5E3E8', '#C3D5DC', '#DEE9ED', '#B8CDD5'],
    textColors: ['#496875', '#385460', '#304852'],
    strokeColors: ['#263B43', '#1D2D33']
  },
  {
    id: 'milk-caramel',
    name: '奶茶焦糖',
    fills: ['#F7EBDD', '#EED9C5', '#E3C6A9', '#F1DDCA', '#D9B996'],
    textColors: ['#916A4C', '#704D36', '#5D402F'],
    strokeColors: ['#432E24', '#33231D']
  },
  {
    id: 'lavender',
    name: '薰衣草紫',
    fills: ['#F1ECF7', '#E4DCEE', '#D8CEE5', '#EBE3F1', '#CBBFD9'],
    textColors: ['#716080', '#594A68', '#4C3F59'],
    strokeColors: ['#382E42', '#29232F']
  },
  {
    id: 'cool-black-silver',
    name: '酷黑银灰',
    fills: ['#F2F2F0', '#DFE0DE', '#CECFCC', '#E8E8E5', '#BFC1BE'],
    textColors: ['#454745', '#303332', '#252827'],
    strokeColors: ['#171918', '#0B0C0C']
  },
  {
    id: 'vintage-olive',
    name: '复古橄榄绿',
    fills: ['#F0F1DF', '#E2E5C8', '#D2D8B2', '#E8EACF', '#C2CAA0'],
    textColors: ['#687044', '#4F5935', '#41492E'],
    strokeColors: ['#303621', '#222719']
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
