# 任务交接：拼贴文字生成器 - 字母纸片溢出/畸形问题

## 项目
collage-text-tool（拼贴文字生成器），仓库：zjinoo23-ui/collage-text-tool，分支：main

## 问题描述
在**逐字模式**下，J、P、Z 等字母的纸片形状出现异常：
- 纸片变成极端三角形/梯形，文字超出纸片边界
- 或纸片形状畸形（斜边被切平、边缘突变）

## 当前代码状态（main 分支最新）
已恢复用户的完整工作（背景图、10套配色、字体、纸片纹理），并在此基础上应用了撕裂约束修复。

## 已应用的修复
1. **`js/paper.js` - `applyTear` 函数**：
   - 新增 `safeBox` 参数（文字安全框）
   - 新增 `inwardSpace(bx, by, nx, ny)`：计算基础点沿法线方向到 safeBox 边界的剩余空间
   - 新增 `tearPoint(bx, by, nx, ny, offset)`：向内凹的 offset 被限制为剩余空间，并用平方渐变衰减避免突变；向外凸的 offset 不限制
   - **核心思路**：不区分斜边/直边，统一沿法线方向约束，保持边的连续性

2. **`js/paper.js` - `generatePaper` 函数**：
   - 计算 safeBox = `boundsW/2 ± textWidth/2 ± 2px`，传给 applyTear

3. **`js/renderer.js`**：
   - 文字定位从 `paper.center`（角点质心）改为 `bounds.w/2, bounds.h/2`（边界中心），与 safeBox 计算一致

## 待验证
- 种子：72906
- 成片单位：逐字
- 字号缩放：185%
- 随机幅度：60%
- 字号随机：开启
- 输入：ABCDEFGHIJKLMNOPQRSTUVWXYZ
- 检查：J、P、Z 是否既不溢出纸片，纸片形状又自然正常

## 关键文件
- `js/paper.js`：`applyTear`（撕裂约束）、`generatePaper`（safeBox 计算）、`buildCorners`（角点生成与拉伸）
- `js/renderer.js`：文字定位（约 137-139 行）
- `js/palettes.js`：配色方案（已有 getColors 方法）

## 注意事项
1. **绝对不要用 `--force` push**：之前因 force push 覆盖了用户在 main 上的工作（背景图、配色更新等），差点丢失。修改前先 `git fetch origin main` 确认远程状态。
2. 用户没有安装 git CLI，只能用 GitHub Desktop 操作。
3. 浏览器需要 `Ctrl+Shift+R` 强制刷新才能加载最新 JS。

## 之前分析过的根因（供参考）
- 旧方案 `pushOutOfSafe`：把侵入点推到最近边，对斜边会跨到对面，形成三角形
- 旧方案 `clampByEdgeNormal`：用 0.01 阈值区分斜边，但矩形边因角点拉伸 nx≈0.05~0.1 被误判为斜边，约束失效；且沿坐标轴推回破坏斜边连续性
- 当前方案：沿法线方向限制 inward offset + 渐变衰减，理论上应同时解决溢出和畸形问题
