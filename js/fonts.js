// fonts.js - Font management (simplified: just list font filenames)
// Local TTF: put .ttf in assets/fonts/, add filename to LOCAL_FONTS below.
// Google Fonts are kept as base; local fonts extend the pool.

const LOCAL_FONTS = [
  'BaoCanMouHuiTingShouXieTi2.0-2.ttf',
  'PangMenZhengDaoXiXianTi-2.ttf',
  'PingFangYuTongTi-2.ttf',
  'SmileySans-Oblique-2.ttf',
  'WuHanYingXiongTi-3.1-2.ttf',
  'YeZiGongChangXiaoShiTou-2.ttf',
  'YouSheYuFeiTeJianKangTi-2.ttf',
  'ZhengQingKeHuangYouTi-1.ttf',
  'ZhengQingKeNanBeiCiGongPuSongTi-2.ttf',
  'ZhouZiFangTi241010-TTF-2.ttf',
  'ZhuoTeZiYouTi-2.otf',
  'ZiKuJiangHuGuFengTi-2.ttf',
];

const GOOGLE_FONTS = [
  { family: 'Noto Sans SC', weight: 400 },
  { family: 'Noto Sans SC', weight: 700 },
  { family: 'Noto Sans', weight: 400 },
  { family: 'Noto Sans', weight: 700 },
  { family: 'serif', weight: 400 },
  { family: 'serif', weight: 700 },
];

const CJK_FALLBACK = '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif';

// Build unified font list from Google + local
const FONTS = [...GOOGLE_FONTS];
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
      new Promise(resolve => setTimeout(resolve, 2000))
    ]);
  }
  return Promise.resolve();
}
