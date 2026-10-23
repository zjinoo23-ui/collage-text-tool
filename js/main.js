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

// === 纸片下拉：原生 select 只负责存值，外观自绘 ===
const dropdowns = [];

document.querySelectorAll('.dropdown').forEach(root => {
  const select = root.querySelector('select');
  const trigger = root.querySelector('.dropdown-trigger');
  const valueEl = root.querySelector('.dropdown-value');
  const menu = root.querySelector('.dropdown-menu');

  const items = [...select.options].map(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dropdown-item';
    btn.setAttribute('role', 'option');
    btn.dataset.value = opt.value;
    btn.textContent = opt.text;
    btn.addEventListener('click', () => {
      if (select.value !== opt.value) {
        select.value = opt.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      close();
    });
    menu.appendChild(btn);
    return btn;
  });

  function syncSelection() {
    const opt = select.selectedOptions[0];
    valueEl.textContent = opt ? opt.text : '';
    items.forEach(it => {
      const on = it.dataset.value === select.value;
      it.classList.toggle('selected', on);
      it.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function open() {
    closeAllDropdowns(api);
    root.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    menu.hidden = false;
  }

  function close() {
    root.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
  }

  const api = { root, close };

  trigger.addEventListener('click', () => {
    if (root.classList.contains('open')) close();
    else open();
  });

  select.addEventListener('change', syncSelection);

  dropdowns.push(api);
  syncSelection();
});

function closeAllDropdowns(except) {
  dropdowns.forEach(d => {
    if (d.root !== except) d.close();
  });
}

document.addEventListener('click', e => {
  if (!e.target.closest('.dropdown')) closeAllDropdowns(null);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAllDropdowns(null);
});

// === 分段选择：色块滑动定位 ===
const segmentContainers = [
  document.getElementById('segmentMode'),
  document.getElementById('alignMode')
];

function syncSegIndicator(container) {
  const indicator = container.querySelector('.seg-indicator');
  const active = container.querySelector('.seg-btn.active');
  if (!indicator || !active) return;
  indicator.style.width = active.offsetWidth + 'px';
  indicator.style.transform = `translateX(${active.offsetLeft}px)`;
}

segmentContainers.forEach(syncSegIndicator);

// === 滑块：左侧砖红填充比例 ===
const sliders = [scaleSlider, randomSlider, gapSlider, lineGapSlider];

function syncSliderFill(el) {
  const min = Number(el.min) || 0;
  const max = Number(el.max) || 100;
  const pct = max > min ? ((Number(el.value) - min) / (max - min)) * 100 : 0;
  el.style.setProperty('--fill', pct + '%');
}

sliders.forEach(syncSliderFill);

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
  // 外框比例跟随所选尺寸，纸边留白保持 3:4 时的一致观感
  previewWrapper.style.aspectRatio = `${size.w} / ${size.h}`;
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
    syncSegIndicator(btn.parentElement);
    debouncedRender();
  });
});

// Align mode
alignModeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    alignModeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.align = btn.dataset.value;
    syncSegIndicator(btn.parentElement);
    debouncedRender();
  });
});

// Scale slider
scaleSlider.addEventListener('input', () => {
  state.scale = parseInt(scaleSlider.value) / 100;
  scaleValue.textContent = scaleSlider.value + '%';
  syncSliderFill(scaleSlider);
  debouncedRender();
});

// Random slider
randomSlider.addEventListener('input', () => {
  state.randomAmount = parseInt(randomSlider.value);
  randomValue.textContent = randomSlider.value + '%';
  syncSliderFill(randomSlider);
  debouncedRender();
});

// Letter spacing
gapSlider.addEventListener('input', () => {
  state.gapScale = parseInt(gapSlider.value) / 100;
  gapValue.textContent = gapSlider.value + '%';
  syncSliderFill(gapSlider);
  debouncedRender();
});

// Line spacing
lineGapSlider.addEventListener('input', () => {
  state.lineGapScale = parseInt(lineGapSlider.value) / 100;
  lineGapValue.textContent = lineGapSlider.value + '%';
  syncSliderFill(lineGapSlider);
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
  segmentContainers.forEach(syncSegIndicator);
  debouncedRender();
});

// Init — render immediately, then re-render when fonts/assets ready
render();
preloadAssets().then(() => render());
preloadBackgrounds().then(() => render());
waitForFonts().then(() => {
  segmentContainers.forEach(syncSegIndicator);
  render();
});
