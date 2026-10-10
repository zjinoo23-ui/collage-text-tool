// fonts.js - Font management (simplified: just list font filenames)
// Local TTF: put .ttf/.otf in assets/fonts/, add filename to LOCAL_FONTS below.

const LOCAL_FONTS = [
  'SmileySans-Oblique-2.ttf',
  'WuHanYingXiongTi-3.1-2.ttf',
  'YeZiGongChangXiaoShiTou-2.ttf',
  'ZhengQingKeHuangYouTi-1.ttf',
  'ZhuoTeZiYouTi-2.otf',
  'ZiKuJiangHuGuFengTi-2.ttf',
];

const CJK_FALLBACK = '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif';

// Build unified font list: ONLY local fonts (Google Fonts are base fallback, not in random pool)
const FONTS = [];
for (const file of LOCAL_FONTS) {
  const name = file.replace(/\.(ttf|otf|woff2?)$/i, '');
  const ext = file.match(/\.(ttf|otf|woff2?)$/i)?.[1]?.toLowerCase() || 'ttf';
  FONTS.push({ family: name, weight: 400, src: `assets/fonts/${file}`, format: ext === 'otf' ? 'opentype' : 'truetype' });
}

// Inject @font-face for local fonts
(function injectLocalFonts() {
  const style = document.createElement('style');
  let css = '';
  for (const f of FONTS) {
    if (f.src) {
      css += `@font-face { font-family: '${f.family}'; font-weight: ${f.weight}; src: url('${f.src}') format('${f.format}'); }\n`;
    }
  }
  if (css) { style.textContent = css; document.head.appendChild(style); }
})();

let fontsReady = false;

export function getFontCount() { return FONTS.length; }

export function getFontCss(index, fontSize) {
  const font = FONTS[index % FONTS.length];
  const fallback = font.family === 'serif' ? 'serif' : CJK_FALLBACK;
  return `${font.weight} ${fontSize}px "${font.family}", ${fallback}`;
}

export function waitForFonts() {
  if (fontsReady) return Promise.resolve();
  if (typeof document !== 'undefined' && document.fonts) {
    return Promise.race([
      document.fonts.ready.then(() => { fontsReady = true; }),
      new Promise(resolve => setTimeout(resolve, 10000))
    ]);
  }
  return Promise.resolve();
}
