// main.js - Application entry point

import { waitForFonts, areFontsReady } from './fonts.js';
import { segmentText } from './segmenter.js';
import { renderToCanvas } from './renderer.js';
import { downloadCanvas } from './export.js';
import { SIZES } from './layout.js';
import { preloadAssets } from './assets.js';
import { preloadBackgrounds } from './backgrounds.js';

// DOM elements
const textInput = document.getElementById('textInput');
const segmentModeBtns = document.querySelectorAll('#segmentMode .seg-btn');
const alignModeBtns = document.querySelectorAll('#alignMode .seg-btn');
const scaleSlider = document.getElementById('scaleSlider');
const scaleValue = document.getElementById('scaleValue');
const randomSlider = document.getElementById('randomSlider');
const randomValue = document.getElementById('randomValue');
const gapSlider = document.getElementById('gapSlider');
const gapValue = document.getElementById('gapValue');
const lineGapSlider = document.getElementById('lineGapSlider');
const lineGapValue = document.getElementById('lineGapValue');
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
  align: 'center',
  scale: 2.0,
  randomAmount: 60,
  gapScale: 0.15,
  lineGapScale: 0.55,
  toggles: { color: true, font: true, size: true },
  sizeKey: 'portrait',
  bgType: 'notebook',
  seed: 9029
};

let renderTimeout = null;

function debouncedRender() {
  if (renderTimeout) clearTimeout(renderTimeout);
  renderTimeout = setTimeout(render, 150);
}

// 字体/渲染错误提示（明确报错，不静默回退）
function setFontError(message) {
  let el = document.getElementById('fontError');
  if (!message) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'fontError';
    el.className = 'font-error';
    previewCanvas.parentElement.appendChild(el);
  }
  el.textContent = message;
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
    gapScale: state.gapScale,
    lineGapScale: state.lineGapScale,
    scale: state.scale,
    toggles: state.toggles
  };
}

function render() {
  // 字体未就绪时不渲染，避免任何系统字体回退
  if (!areFontsReady()) return;

  const params = getParams();
  const size = SIZES[params.sizeKey];

  // Render at full resolution to offscreen canvas
  try {
    renderToCanvas(params, exportCanvas);
    setFontError('');
  } catch (err) {
    console.error(err);
    setFontError(err.message || '字体加载失败');
    return;
  }

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

// Letter spacing
gapSlider.addEventListener('input', () => {
  state.gapScale = parseInt(gapSlider.value) / 100;
  gapValue.textContent = gapSlider.value + '%';
  debouncedRender();
});

// Line spacing
lineGapSlider.addEventListener('input', () => {
  state.lineGapScale = parseInt(lineGapSlider.value) / 100;
  lineGapValue.textContent = lineGapSlider.value + '%';
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
preloadBackgrounds().then(() => render());
waitForFonts().then(() => render());
