// segmenter.js - Text segmentation for collage units

const CHINESE_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const ALNUM_RE = /[a-zA-Z0-9]/;
const PUNCT_RE = /[，。、；：！？""''（）《》【】…—·,\.!?;:'"\(\)\[\]{}\\/<>@#$%^&*+=|~`-]/;

export function isPunct(ch) {
  return PUNCT_RE.test(ch);
}
export function isChinese(ch) {
  return CHINESE_RE.test(ch);
}
function isAlnum(ch) {
  return ALNUM_RE.test(ch);
}
function isSpace(ch) {
  return /\s/.test(ch);
}
function isNewline(ch) {
  return ch === '\n' || ch === '\r';
}

/**
 * Segment text into collage units.
 * @param {string} text - Input text
 * @param {'char'|'mixed'|'word'} mode - Segmentation mode
 * @returns {Array<{text: string, index: number}>} Array of units with original char index
 */
export function segmentText(text, mode) {
  const units = [];

  // Helper: push a unit with metadata
  function push(text, index, extra = {}) {
    units.push({ text, index, isPunct: PUNCT_RE.test(text), ...extra });
  }

  if (mode === 'char') {
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (isNewline(ch)) {
        units.push({ text: '\n', index: i, isBreak: true });
      } else if (!isSpace(ch)) {
        push(ch, i);
      }
    }
  } else if (mode === 'mixed') {
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (isNewline(ch)) {
        units.push({ text: '\n', index: i, isBreak: true });
        i++;
        continue;
      }
      if (isSpace(ch)) { i++; continue; }
      if (isChinese(ch) || isPunct(ch)) {
        push(ch, i);
        i++;
      } else if (isAlnum(ch)) {
        let word = '';
        const startIdx = i;
        while (i < text.length && isAlnum(text[i])) { word += text[i]; i++; }
        push(word, startIdx);
      } else {
        push(ch, i);
        i++;
      }
    }
  } else if (mode === 'word') {
    // Split by newlines first, then by spaces within each line
    const lines = text.split(/\r?\n/);
    let charIdx = 0;
    lines.forEach((line, lineIdx) => {
      if (lineIdx > 0) {
        units.push({ text: '\n', index: charIdx, isBreak: true });
        charIdx++; // for the newline char
      }
      const tokens = line.split(/\s+/);
      for (const token of tokens) {
        if (token.length > 0) {
          push(token, charIdx);
        }
        charIdx += token.length + 1;
      }
    });
  }

  return units;
}
