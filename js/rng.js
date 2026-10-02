// rng.js - Seeded pseudo-random number generator
// Mulberry32 algorithm for fast, deterministic PRNG

export function createRng(seed) {
  let state = seed >>> 0;

  function next() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    /** Returns float in [0, 1) */
    next,

    /** Returns float in [min, max) */
    range(min, max) {
      return min + next() * (max - min);
    },

    /** Returns integer in [min, max] inclusive */
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },

    /** Returns true with probability p (0-1) */
    chance(p) {
      return next() < p;
    },

    /** Picks a random element from array */
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },

    /** Returns a gaussian-like value in [-1, 1] using sum of uniforms */
    gauss() {
      return (next() + next() + next() - 1.5) / 1.5;
    }
  };
}

/** Hash a string to a 32-bit integer seed */
export function hashString(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Create a derived RNG from a parent seed + index (for position-based randomness) */
export function createPositionRng(seed, position) {
  return createRng((seed ^ (position * 2654435761)) >>> 0);
}
