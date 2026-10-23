// fonts.js - 字体系统
// 规则：assets/fonts 是唯一字体来源；按字素语言分池随机；禁止任何系统字体回退。

// 字体清单（唯一来源）——文件 → 池归属
// 英文池（纯英文字体，不含中文字形）6 个
// 中文池（中文字体，兼容中英文）10 个
const FONT_FILES = [
  { file: 'Anton-Regular.ttf', pool: 'en' },
  { file: 'PlayfairDisplay-Regular.ttf', pool: 'en' },
  { file: 'PlayfairDisplay-Bold.ttf', pool: 'en' },
  { file: 'PlayfairDisplay-Italic.ttf', pool: 'en' },
  { file: 'SpecialElite-Regular.ttf', pool: 'en' },
  { file: 'ZCOOL Addict Italic 01.ttf', pool: 'en' },
  { file: 'SmileySans-Oblique-2.ttf', pool: 'cn' },
  { file: 'SourceHanSerifCN-Regular-1.otf', pool: 'cn' },
  { file: 'SourceHanSerifCN-Heavy-4.otf', pool: 'cn' },
  { file: 'WuHanYingXiongTi-3.1-2.ttf', pool: 'cn' },
  { file: 'ZhengQingKeHuangYouTi-1.ttf', pool: 'cn' },
  { file: 'ZhuoTeZiYouTi-2.otf', pool: 'cn' },
  { file: '站酷仓耳渔阳体-W02.ttf', pool: 'cn' },
  { file: '站酷仓耳渔阳体-W04.ttf', pool: 'cn' },
  { file: '站酷快乐体2016修订版.ttf', pool: 'cn' },
  { file: '站酷文艺体.ttf', pool: 'cn' },
];

function familyOf(file) {
  return file.replace(/\.(ttf|otf|woff2?)$/i, '');
}

const FONTS = FONT_FILES.map(({ file, pool }) => ({
  family: familyOf(file),
  pool,
  src: `assets/fonts/${encodeURIComponent(file)}`,
}));

export const EN_FONTS = FONTS.filter(f => f.pool === 'en').map(f => f.family);
export const CN_FONTS = FONTS.filter(f => f.pool === 'cn').map(f => f.family);

// CJK 判定：汉字、CJK 标点（，。！？「」等）、假名、全角字符
const CJK_RE = /[\u2e80-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/;

export function isCjkText(text) {
  return CJK_RE.test(text);
}

/**
 * 按字素内容取所属字体池，两池互不混用。
 */
export function getFontPool(text) {
  return isCjkText(text) ? CN_FONTS : EN_FONTS;
}

// 加载状态：family → 是否成功加载
const loadedFamilies = new Set();
let fontsReady = false;
let loadPromise = null;

function isAvailable(family) {
  if (!loadedFamilies.has(family)) return false;
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      return document.fonts.check(`400 64px "${family}"`);
    } catch {
      return true;
    }
  }
  return true;
}

/**
 * 加载 assets/fonts 下全部字体。
 * 用 FontFace API 显式加载，成功/失败可判定（不存在静默回退）。
 */
export function waitForFonts() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    if (typeof document === 'undefined' || typeof FontFace === 'undefined') {
      fontsReady = true;
      return;
    }
    await Promise.race([
      Promise.all(FONTS.map(async f => {
        try {
          const face = new FontFace(f.family, `url("${f.src}")`, { weight: '400' });
          await face.load();
          document.fonts.add(face);
          loadedFamilies.add(f.family);
        } catch (err) {
          console.warn(`[fonts] 加载失败：${f.family}`, err);
        }
      })),
      new Promise(resolve => setTimeout(resolve, 15000)),
    ]);
    fontsReady = true;
  })();
  return loadPromise;
}

export function areFontsReady() {
  return fontsReady;
}

/**
 * 在字素所属池内等概率随机选一个已加载字体。
 * 池内全部未加载时抛错，绝不用系统字体渲染。
 */
export function pickFontFamily(text, rng) {
  const pool = getFontPool(text);
  const available = pool.filter(isAvailable);
  if (available.length === 0) {
    const poolName = pool === CN_FONTS ? '中文池' : '英文池';
    throw new Error(`字体加载失败：${poolName}无可用字体（${text}）`);
  }
  return available[rng.int(0, available.length - 1)];
}

/**
 * 只写池内字体的 family，不追加任何系统字体兜底。
 */
export function getFontCss(family, fontSize) {
  return `400 ${fontSize}px "${family}"`;
}
