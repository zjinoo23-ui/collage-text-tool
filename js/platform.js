// platform.js - 平台适配层：图片保存与文本复制
// 浏览器实现。小工具容器构建时由 build-minitool.mjs 整体替换为 platform-minitool.js，
// 以免小工具产物里残留容器禁用的 a[download] / clipboard / execCommand。

import { cropToContent } from './export.js';

/**
 * 是否运行在小工具容器内。
 * 浏览器实现恒为 false。
 */
export function isMiniTool() {
  return false;
}

/**
 * 保存画布为图片。
 * 浏览器实现：转 Blob 后触发下载。
 * @param {HTMLCanvasElement} canvas
 * @param {{transparent?: boolean, seed?: number}} options
 * @returns {Promise<void>}
 */
export function saveImage(canvas, options) {
  const { transparent = false, seed = 0 } = options || {};
  const ext = transparent ? 'png' : 'jpg';
  const mimeType = transparent ? 'image/png' : 'image/jpeg';
  const quality = transparent ? undefined : 0.92;
  const filename = `collage_${seed}_${Date.now()}.${ext}`;

  return new Promise((resolve, reject) => {
    // 透明 PNG 按实际内容边界裁剪，不保留固定画幅的透明边
    const source = transparent ? cropToContent(canvas) : canvas;
    source.toBlob((blob) => {
      if (!blob) {
        reject(new Error('导出失败'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    }, mimeType, quality);
  });
}

/**
 * 复制文本到剪贴板。
 * @param {string} text
 * @returns {Promise<boolean>} 是否复制成功
 */
export async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // 权限被拒时走下面的兜底
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (err) {
    return false;
  }
}
