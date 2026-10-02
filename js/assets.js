// assets.js - Paper texture asset management (Layer 3: 纸纹质感)
// Shape (Layer 1) and tear (Layer 2) are programmatic — only textures come from files.
// Replace files in assets/textures/ with your own (must support seamless tiling).

// ── Paper textures (纸张质感纹理) ──
// Replace these SVG placeholders with your own PNG/JPG files (seamless tileable).
// To add more: { name: 'xxx', path: 'assets/textures/xxx.png' }
export const TEXTURES = [
  { name: 'kraft',     path: 'assets/textures/kraft.png' },
  { name: 'notebook',  path: 'assets/textures/notebook.png' },
  { name: 'newspaper', path: 'assets/textures/newspaper.png' },
  { name: 'grid',      path: 'assets/textures/grid.png' },
  { name: 'dot',       path: 'assets/textures/dot.png' },  
  { name: '001',       path: 'assets/textures/001.png' },  
  { name: '002',       path: 'assets/textures/002.png' },  
  { name: '003',       path: 'assets/textures/003.png' },  
  { name: '004',       path: 'assets/textures/004.png' },  
  { name: '005',       path: 'assets/textures/005.png' },  
  { name: '006',       path: 'assets/textures/006.png' },  
  { name: '007',       path: 'assets/textures/007.png' },  
  { name: '008',       path: 'assets/textures/008.png' },  
  { name: '009',       path: 'assets/textures/009.png' },  
  { name: '010',       path: 'assets/textures/010.png' },  
  { name: '011',       path: 'assets/textures/011.png' },  
  { name: '012',       path: 'assets/textures/012.png' },  
  { name: '013',       path: 'assets/textures/013.png' },  
  { name: '014',       path: 'assets/textures/014.png' },  
  { name: '015',       path: 'assets/textures/015.png' },  
  { name: '016',       path: 'assets/textures/016.png' },  
  { name: '017',       path: 'assets/textures/017.png' },  
  { name: '018',       path: 'assets/textures/018.png' },
];

// Loaded image cache
let textureImages = [];
let loaded = false;

export function getTextureImages() { return textureImages; }

/**
 * Preload all texture images. Call once on startup.
 */
export function preloadAssets() {
  return Promise.all(TEXTURES.map(t => loadImage(t.path))).then(results => {
    textureImages = results;
    loaded = true;
    console.log(`[assets] loaded ${textureImages.filter(Boolean).length}/${textureImages.length} textures`);
  }).catch(err => {
    console.warn('[assets] textures failed to load, falling back to colors:', err);
    loaded = false;
  });
}

function loadImage(path) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = path;
  });
}

export function assetsReady() { return loaded; }
