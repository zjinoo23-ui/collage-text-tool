// main.js - Application entry point

import { waitForFonts, areFontsReady } from './fonts.js';
import { segmentText } from './segmenter.js';
import { renderToCanvas } from './renderer.js';
import { cropToContent } from './export.js';
import { isMiniTool, saveImage, copyText, canPublishNote, publishNote } from './platform.js';
import { SIZES } from './layout.js';
import { preloadAssets } from './assets.js';
import { preloadBackgrounds } from './backgrounds.js';

// 页面版本号：后续升级只改这一处
const VERSION = 'v0.5.1';

// DOM elements
const textInput = document.getElementById('textInput');
const segmentModeBtns = document.querySelectorAll('#segmentMode .seg-btn');
const alignModeBtns = document.querySelectorAll('#alignMode .seg-btn');
const valignModeBtns = document.querySelectorAll('#valignMode .seg-btn');
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
const postNoteBtn = document.getElementById('postNoteBtn');
const copyParamsBtn = document.getElementById('copyParamsBtn');
const copyLabel = document.getElementById('copyLabel');
const previewCanvas = document.getElementById('previewCanvas');
const exportCanvas = document.getElementById('exportCanvas');
const previewLoading = document.getElementById('previewLoading');
const saveModal = document.getElementById('saveModal');
const saveModalImg = document.getElementById('saveModalImg');
const saveModalClose = document.getElementById('saveModalClose');
const copyModal = document.getElementById('copyModal');
const copyModalText = document.getElementById('copyModalText');
const copyModalClose = document.getElementById('copyModalClose');
const appVersion = document.getElementById('appVersion');
if (appVersion) appVersion.textContent = VERSION;
// 小工具容器里保存走系统相册，按钮文案对齐实际行为
if (isMiniTool()) downloadBtn.textContent = '保存到相册';

// State
const state = {
  segmentMode: 'mixed',
  align: 'center',
  valign: 'middle',
  scale: 2.0,
  randomAmount: 60,
  gapScale: 0.15,
  lineGapScale: 0.65,
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
    valign: state.valign,
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
    positionMenu();
  }

  // 菜单挂在 body 上（fixed 定位）：既不会被折叠卡片的 overflow 裁掉，
  // 也能在手机窄屏时夹在视口内，下方空间不够就向上展开。
  function positionMenu() {
    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const margin = 8;
    menu.style.minWidth = Math.round(rect.width) + 'px';
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;

    let left = rect.left;
    if (left + mw > window.innerWidth - margin) left = window.innerWidth - margin - mw;
    if (left < margin) left = margin;

    let top = rect.bottom + gap;
    if (top + mh > window.innerHeight - margin) {
      const above = rect.top - gap - mh;
      top = above >= margin ? above : Math.max(margin, window.innerHeight - margin - mh);
    }

    menu.style.left = Math.round(left) + 'px';
    menu.style.top = Math.round(top) + 'px';
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

  document.body.appendChild(menu);
  dropdowns.push(api);
  syncSelection();
});

function closeAllDropdowns(except) {
  dropdowns.forEach(d => {
    if (d.root !== except) d.close();
  });
}

document.addEventListener('click', e => {
  if (!e.target.closest('.dropdown') && !e.target.closest('.dropdown-menu')) {
    closeAllDropdowns(null);
  }
});

// fixed 定位的菜单不跟随滚动，滚动或旋转屏幕时直接收起
window.addEventListener('scroll', () => closeAllDropdowns(null), { passive: true });
window.addEventListener('resize', () => closeAllDropdowns(null));

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAllDropdowns(null);
});

// === 分段选择：色块滑动定位 ===
const segmentContainers = [
  document.getElementById('segmentMode'),
  document.getElementById('alignMode'),
  document.getElementById('valignMode')
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
  // Chrome 61 基线：aspect-ratio 不生效时改用比例盒 padding-bottom
  previewWrapper.style.setProperty('--preview-pad', `${(size.h / size.w) * 100}%`);
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

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

// 纸片卡折叠
document.querySelectorAll('.card-title').forEach(btn => {
  const card = btn.closest('.paper-card');

  // 默认展开的卡片直接标记为已展开：此时才放开 overflow 裁剪，露出控件投影
  if (!card.classList.contains('collapsed')) card.classList.add('card-open');

  btn.addEventListener('click', () => {
    // 折叠时把挂在 body 上的下拉菜单一并收起
    closeAllDropdowns(null);
    const collapsed = card.classList.toggle('collapsed');
    btn.setAttribute('aria-expanded', String(!collapsed));

    // 过渡期间保持裁剪，动画结束后再放开，避免内容溢出卡片
    clearTimeout(card.revealTimer);
    card.classList.remove('card-open');
    if (!collapsed) {
      card.revealTimer = setTimeout(() => card.classList.add('card-open'), 210);
      // 展开后重新定位分段色块（折叠期间宽度为 0）
      requestAnimationFrame(() => {
        card.querySelectorAll('.segmented-control').forEach(syncSegIndicator);
      });
    }
  });
});

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

// Vertical align mode
valignModeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    valignModeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.valign = btn.dataset.value;
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
  const key = state.sizeKey;
  preloadBackgrounds(key).then(() => {
    if (state.sizeKey === key) render();
  });
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

// === 弹窗（手机保存图 / 复制失败兜底） ===
function isTouchUI() {
  return window.matchMedia('(pointer: coarse)').matches ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function openModal(modal) {
  modal.hidden = false;
  document.body.classList.add('modal-open');
}

function closeModals() {
  [saveModal, copyModal].forEach(m => { m.hidden = true; });
  document.body.classList.remove('modal-open');
}

[saveModal, copyModal].forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModals();
  });
});
saveModalClose.addEventListener('click', closeModals);
copyModalClose.addEventListener('click', closeModals);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModals();
});

// Download
downloadBtn.addEventListener('click', async () => {
  const transparent = state.bgType === 'transparent';
  // 小工具容器：走平台 API 保存到系统相册
  if (isMiniTool()) {
    try {
      await saveImage(exportCanvas, { transparent, seed: state.seed });
    } catch (err) {
      console.error(err);
      window.alert('保存到相册失败，请重试');
    }
    return;
  }
  if (!isTouchUI()) {
    saveImage(exportCanvas, { transparent, seed: state.seed });
    return;
  }
  // 手机端：大图预览 + 长按保存（透明 PNG 同样按实际内容边界裁剪）
  try {
    const modalCanvas = transparent ? cropToContent(exportCanvas) : exportCanvas;
    saveModalImg.src = modalCanvas.toDataURL(transparent ? 'image/png' : 'image/jpeg', 0.92);
    openModal(saveModal);
  } catch (err) {
    console.error(err);
    window.alert('导出图片失败，请重试');
  }
});

// 发到小红书：仅在小工具容器内、且容器提供 postNote 接口时显示
const POST_NOTE_LABEL = '发到小红书';
if (canPublishNote()) postNoteBtn.hidden = false;

let postNoteTimer = null;
postNoteBtn.addEventListener('click', async () => {
  const transparent = state.bgType === 'transparent';
  postNoteBtn.disabled = true;
  postNoteBtn.textContent = '准备中…';
  try {
    await publishNote(exportCanvas, {
      transparent,
      title: '拼贴文字',
      content: buildParamsText()
    });
    postNoteBtn.textContent = '✓ 已打开发布页';
  } catch (err) {
    console.error('[export] postNote failed', err);
    postNoteBtn.textContent = '发布失败，请重试';
  } finally {
    postNoteBtn.disabled = false;
    if (postNoteTimer) clearTimeout(postNoteTimer);
    postNoteTimer = setTimeout(() => {
      postNoteBtn.textContent = POST_NOTE_LABEL;
    }, 2000);
  }
});

// 复制参数
const SEGMENT_LABELS = { char: '逐字', mixed: '混合', block: '整片' };
const ALIGN_LABELS = { left: '左', center: '居中', right: '右' };
const VALIGN_LABELS = { top: '顶', middle: '居中', bottom: '底' };

function buildParamsText() {
  const sizeText = sizeSelect.options[sizeSelect.selectedIndex].text;
  const bgText = bgSelect.options[bgSelect.selectedIndex].text;
  return [
    '【拼贴参数】',
    `文字：${textInput.value}`,
    `种子：${seedInput.value}`,
    `成片单位：${SEGMENT_LABELS[state.segmentMode]}`,
    `对齐：${ALIGN_LABELS[state.align]}`,
    `垂直对齐：${VALIGN_LABELS[state.valign]}`,
    `字号缩放：${scaleSlider.value}%`,
    `随机幅度：${randomSlider.value}%`,
    `字间距：${gapSlider.value}%`,
    `行间距：${lineGapSlider.value}%`,
    `字号随机：${toggleSize.checked ? '开' : '关'}`,
    `尺寸：${sizeText}`,
    `背景：${bgText}`
  ].join('\n');
}

let copyResetTimer = null;
copyParamsBtn.addEventListener('click', async () => {
  const text = buildParamsText();
  const ok = await copyText(text);
  if (!ok) {
    // 兜底：弹窗展示完整参数，供长按复制
    copyModalText.value = text;
    openModal(copyModal);
    requestAnimationFrame(() => {
      copyModalText.focus();
      copyModalText.select();
      copyModalText.scrollTop = 0;
    });
    return;
  }
  copyLabel.textContent = '✓ 已复制';
  copyParamsBtn.classList.add('copied');
  if (copyResetTimer) clearTimeout(copyResetTimer);
  copyResetTimer = setTimeout(() => {
    copyLabel.textContent = '复制参数';
    copyParamsBtn.classList.remove('copied');
  }, 2000);
});

// Window resize
window.addEventListener('resize', () => {
  segmentContainers.forEach(syncSegIndicator);
  debouncedRender();
});

// Init — render immediately, then re-render when fonts/assets ready
render();
preloadAssets().then(() => render());
preloadBackgrounds(state.sizeKey).then(() => render());
waitForFonts().then(() => {
  // 字体就绪后移除轻提示，并重绘画布
  if (previewLoading) previewLoading.hidden = true;
  segmentContainers.forEach(syncSegIndicator);
  render();
});
