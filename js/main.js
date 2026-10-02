// main.js - Application entry point

import { waitForFonts } from './fonts.js';
import { segmentText } from './segmenter.js';
import { renderToCanvas } from './renderer.js';
import { downloadCanvas } from './export.js';
import { SIZES } from './layout.js';
import { preloadAssets } from './assets.js';

// DOM elements
const textInput = document.getElementById('textInput');
const segmentModeBtns = document.querySelectorAll('#segmentMode .seg-btn');
const alignModeBtns = document.querySelectorAll('#alignMode .seg-btn');
const scaleSlider = document.getElementById('scaleSlider');
const scaleValue = document.getElementById('scaleValue');
const randomSlider = document.getElementById('randomSlider');
const randomValue = document.getElementById('randomValue');
const toggleSize = document.getElementById('toggleSize');
const sizeSelect = document.getElementById('sizeSelect');
const bgSelect = document.getElementById('bgSelect');
const seedInput = document.getElementById('seedInput');
const regenBtn = document.getElementById('regenBtn');
const downloadBtn = document.getElementById('downloadBtn');
const previewCanvas = document.getElementById('previewCanvas');
const exportCanvas = document.getElementById('exportCanvas');

// State
const state = {
  segmentMode: 'mixed',
  align: 'left',
  scale: 1.0,
  randomAmount: 60,
  toggles: { color: true, font: true, size: true },
  sizeKey: 'portrait',
  bgType: 'white',
  seed: 42
};

let renderTimeout = null;

function debouncedRender() {
  if (renderTimeout) clearTimeout(renderTimeout);
  renderTimeout = setTimeout(render, 150);
}

function getParams() {
  return {
    text: textInput.value || ' ',
    segmentMode: state.segmentMode,
    align: state.align,
    sizeKey: state.sizeKey,
    bgType: state.bgType,
    seed: state.seed,
    randomAmount: state.randomAmount,
    scale: state.scale,
    toggles: state.toggles
  };
}

function render() {
  const params = getParams();
  const size = SIZES[params.sizeKey];

  // Render at full resolution to offscreen canvas
  renderToCanvas(params, exportCanvas);

  // Draw scaled preview
  const previewWrapper = previewCanvas.parentElement;
  let maxW = previewWrapper.clientWidth - 4;
  let maxH = previewWrapper.clientHeight - 4;

  // Fallback if wrapper hasn't sized yet
  if (maxH < 100) {
    maxH = maxW * (size.h / size.w);
  }
  if (maxW < 100) {
    maxW = 300;
    maxH = maxW * (size.h / size.w);
  }

  const aspect = size.w / size.h;

  let pw = maxW;
  let ph = pw / aspect;
  if (ph > maxH) {
    ph = maxH;
    pw = ph * aspect;
  }

  const dpr = window.devicePixelRatio || 1;
  previewCanvas.width = Math.max(1, Math.round(pw * dpr));
  previewCanvas.height = Math.max(1, Math.round(ph * dpr));
  previewCanvas.style.width = pw + 'px';
  previewCanvas.style.height = ph + 'px';

  const pctx = previewCanvas.getContext('2d');
  pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  pctx.clearRect(0, 0, pw, ph);
  pctx.drawImage(exportCanvas, 0, 0, pw, ph);
}

// === Event listeners ===

textInput.addEventListener('input', debouncedRender);

// Segment mode
segmentModeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    segmentModeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.segmentMode = btn.dataset.value;
    debouncedRender();
  });
});

// Align mode
alignModeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    alignModeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.align = btn.dataset.value;
    debouncedRender();
  });
});

// Scale slider
scaleSlider.addEventListener('input', () => {
  state.scale = parseInt(scaleSlider.value) / 100;
  scaleValue.textContent = scaleSlider.value + '%';
  debouncedRender();
});

// Random slider
randomSlider.addEventListener('input', () => {
  state.randomAmount = parseInt(randomSlider.value);
  randomValue.textContent = randomSlider.value + '%';
  debouncedRender();
});

// Toggles (color & font are always random; only size is user-controllable)
toggleSize.addEventListener('change', () => {
  state.toggles.size = toggleSize.checked;
  debouncedRender();
});

// Size & bg
sizeSelect.addEventListener('change', () => {
  state.sizeKey = sizeSelect.value;
  debouncedRender();
});
bgSelect.addEventListener('change', () => {
  state.bgType = bgSelect.value;
  debouncedRender();
});

// Seed
seedInput.addEventListener('change', () => {
  const v = parseInt(seedInput.value);
  state.seed = isNaN(v) ? 0 : v;
  debouncedRender();
});

regenBtn.addEventListener('click', () => {
  state.seed = Math.floor(Math.random() * 100000);
  seedInput.value = state.seed;
  debouncedRender();
});

// Download
downloadBtn.addEventListener('click', () => {
  const transparent = state.bgType === 'transparent';
  downloadCanvas(exportCanvas, state.seed, transparent);
});

// Window resize
window.addEventListener('resize', () => {
  debouncedRender();
});

// Init — render immediately, then re-render when fonts/assets ready
render();
preloadAssets().then(() => render());
waitForFonts().then(() => render());
