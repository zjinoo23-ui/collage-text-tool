// platform-minitool.js - 小工具容器适配层
// 容器禁用剪贴板与 a[download]，改用平台 JS API：
//   window.xhs.miniTool.saveImageToPhotosAlbum —— 保存图片到系统相册
//   window.xhs.miniTool.writeTempFile —— base64 落成临时文件（大图先落盘再保存）
// 详见小工具在线文档 §3.4 / §3.5。

import { cropToContent } from './export.js';

/**
 * 小工具容器内恒为 true。
 */
export function isMiniTool() {
  return true;
}

function getMiniTool() {
  const xhs = window.xhs;
  return xhs && xhs.miniTool ? xhs.miniTool : null;
}

/**
 * 保存画布为图片：写入系统相册。
 * 需由用户手势触发（下载按钮点击），首次调用可能弹系统相册授权。
 * @param {HTMLCanvasElement} canvas
 * @param {{transparent?: boolean, seed?: number}} options
 * @returns {Promise<void>}
 */
export async function saveImage(canvas, options) {
  const { transparent = false } = options || {};
  const miniTool = getMiniTool();
  if (!miniTool || typeof miniTool.saveImageToPhotosAlbum !== 'function') {
    throw new Error('当前环境不支持保存到相册');
  }

  const mimeType = transparent ? 'image/png' : 'image/jpeg';
  // 透明 PNG 按实际内容边界裁剪，不保留固定画幅的透明边
  const source = transparent ? cropToContent(canvas) : canvas;
  const dataUrl = source.toDataURL(mimeType, 0.92);

  // 大图先落成临时文件，避免超长 base64 直接上行
  if (typeof miniTool.writeTempFile === 'function') {
    try {
      const res = await miniTool.writeTempFile({ data: dataUrl });
      const filePath = res && (res.filePath || (res.data && res.data.filePath));
      if (filePath) {
        await miniTool.saveImageToPhotosAlbum({ filePath });
        return;
      }
    } catch (err) {
      console.warn('[platform] writeTempFile 失败，回退 data URI', err);
    }
  }

  await miniTool.saveImageToPhotosAlbum({ filePath: dataUrl });
}

/**
 * 容器禁用剪贴板，恒返回 false，
 * 由调用方弹出可选文本弹窗，引导用户长按复制。
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyText(text) {
  return false;
}
