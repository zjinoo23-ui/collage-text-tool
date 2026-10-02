// palettes.js - Color palette management system

// Built-in palettes (can be extended by adding JSON files to assets/palettes/)
const PALETTES = [
  {
    id: 'vintage-cream',
    name: '复古奶油',
    fills: ['#FFF8E7', '#F5E6C8', '#E8D5B0', '#D4C4A8', '#F0DFC0'],
    strokes: ['#8B7355', '#6B5344']
  },
  {
    id: 'morandi-pink',
    name: '莫兰迪灰粉',
    fills: ['#F5E6E0', '#E8D5D0', '#DCC8C4', '#F0E0DC', '#E5D0CC'],
    strokes: ['#7A6B68', '#5C4F4C']
  },
  {
    id: 'kraft-brown',
    name: '牛皮纸暖褐',
    fills: ['#E8D8C0', '#DCC8A8', '#D0BC90', '#E0D0B8', '#C8B898'],
    strokes: ['#6B5D4F', '#4A3F35']
  },
  {
    id: 'cinnabar-blue',
    name: '朱砂红配墨蓝',
    fills: ['#F5E6E0', '#E8D0C8', '#F0D8D0', '#DCC0B8', '#E5CCC4'],
    strokes: ['#2C3E6B', '#8B2C2C']
  },
  {
    id: 'low-sat-candy',
    name: '低饱和糖果',
    fills: ['#F0E8F5', '#E0E8F0', '#F5E8E0', '#E8F0E0', '#F0F0E0'],
    strokes: ['#6B6B8B', '#5C5C5C']
  },
  {
    id: 'mono-mono',
    name: '黑白灰极简',
    fills: ['#F5F5F5', '#E8E8E8', '#F0F0F0', '#E0E0E0', '#FAFAFA'],
    strokes: ['#333333', '#1A1A1A']
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
 * @returns {object} { palette, getFill(position), getStroke(position) }
 */
export function createColorScheme(rng, driftAmount = 0) {
  const palette = rng.pick(PALETTES);

  function driftColor(hex) {
    if (driftAmount <= 0) return hex;
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

  return {
    palette,
    getFill(positionRng) {
      const base = positionRng.pick(palette.fills);
      return driftAmount > 0 ? driftColorWithRng(base, positionRng, driftAmount) : base;
    },
    getStroke(positionRng) {
      // 90% chance: use fixed anchor stroke; 10% chance: pick any fill color as "撞色"
      if (positionRng.chance(0.1)) {
        const base = positionRng.pick(palette.fills);
        return driftAmount > 0 ? driftColorWithRng(base, positionRng, driftAmount) : base;
      }
      return positionRng.pick(palette.strokes);
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
