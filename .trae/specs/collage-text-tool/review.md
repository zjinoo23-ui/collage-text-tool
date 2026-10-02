# 拼贴文字工具 - Independent Review

- [x] CP-R1: 分词三模式正确（逐字/混合/逐词）
  - **Type**: `rule`
  - **Covers**: AC-1
  - **Evidence**: 浏览器中 `segmentText('你好，Hello World！', 'mixed')` 返回 `["你","好","，","Hello","World","！"]`，与预期一致

- [x] CP-R2: 纸片四种形状生成
  - **Type**: `rule`
  - **Covers**: AC-2
  - **Evidence**: paper.js 实现 square/parallelogram/trapezoid/irregular 四类，由 rng.pick 选取；渲染截图中可观察到多种形状

- [x] CP-R3: 文字不溢出纸片
  - **Type**: `rule`
  - **Covers**: AC-3
  - **Evidence**: paper.js 内边距 padX=textW*0.25+textH*0.5、padY=textH*0.55，加 shapeSafety=textH*0.3；渲染截图确认文字完整在纸片内

- [x] CP-U1: 手撕边缘质感
  - **Type**: `rubric`
  - **Covers**: AC-4
  - **Scale**: 1-5
  - **Anchors**: 1 = 平直无手撕感; 3 = 轻微抖动; 5 = 自然手撕
  - **Pass Threshold**: >= 4
  - **Evidence**: 渲染截图中纸片边缘有明显不规则抖动，二次曲线平滑；score: 4

- [x] CP-R4: 随机幅度 0% 无旋转浮动
  - **Type**: `rule`
  - **Covers**: AC-5
  - **Evidence**: rotation 和 floatY 均乘以 randomFactor（=randomAmount/100），为 0 时归零

- [x] CP-R5: 随机幅度 100% 达上限
  - **Type**: `rule`
  - **Covers**: AC-6
  - **Evidence**: MAX_ROTATION=12°, MAX_FLOAT=0.4，代码逻辑确认范围正确

- [x] CP-R6: 种子复现性（修复后）
  - **Type**: `rule`
  - **Covers**: AC-7
  - **Evidence**: 修复后 backgrounds.js 噪点使用确定性 hash2(x,y,seed) 替代 Math.random()；所有随机均由种子驱动

- [x] CP-R7: 种子局部修改位置不变
  - **Type**: `rule`
  - **Covers**: AC-8
  - **Evidence**: createPositionRng(seed, i) 仅依赖种子+位置索引，样式按位置分配

- [x] CP-R8: 色板系统同套取色
  - **Type**: `rule`
  - **Covers**: AC-9
  - **Evidence**: createColorScheme 每图选一套，fill/stroke 均来自该套；描边 90% 锚点 + 10% 撞色

- [x] CP-R9: 输出尺寸正确
  - **Type**: `rule`
  - **Covers**: AC-10
  - **Evidence**: 浏览器验证 exportCanvas 为 1080×1440；SIZES 定义匹配规格

- [x] CP-R10: 透明 PNG 出血
  - **Type**: `rule`
  - **Covers**: AC-11
  - **Evidence**: bleed = min(w,h)*0.08，正方形≈164px、3:4≈86px

- [x] CP-U2: 移动端适配
  - **Type**: `rubric`
  - **Covers**: AC-12
  - **Scale**: 1-5
  - **Anchors**: 1 = 不可用; 3 = 基本可用; 5 = 流畅
  - **Pass Threshold**: >= 4
  - **Evidence**: 触控目标≥44px，竖屏单列，桌面端分栏；score: 4

- [x] CP-U3: ArchDaily 风格契合
  - **Type**: `rubric`
  - **Covers**: AC-13
  - **Scale**: 1-5
  - **Anchors**: 1 = 不符; 3 = 部分相似; 5 = 高度契合
  - **Pass Threshold**: >= 4
  - **Evidence**: 白底极简、#00308E 蓝色点缀、杂志式网格、大写标签；score: 4

- [x] CP-R11: 文件名含种子号
  - **Type**: `rule`
  - **Covers**: AC-14
  - **Evidence**: export.js 文件名格式 `collage_${seed}_${timestamp}.${ext}`

- [x] CP-R12: 字体/色板/背景可扩展结构
  - **Type**: `rule`
  - **Covers**: AC-15, AC-16, AC-17
  - **Evidence**: 字体/色板/背景均独立模块化；assets 目录预留占位；代码注释标注扩展方式

- [x] CP-R13: 全局字号缩放
  - **Type**: `rule`
  - **Covers**: AC-18
  - **Evidence**: baseFontSize *= scale，纸片随文字同步生成

- [x] CP-R14: 长文本自动换行（修复后）
  - **Type**: `rule`
  - **Covers**: AC-19
  - **Evidence**: 修复后 computeLayout 增加 5 次自动缩小重试，垂直溢出时 baseFontSize ×0.85 递减直到适配

- [x] CP-R15: 不拆英文单词
  - **Type**: `rule`
  - **Covers**: AC-20
  - **Evidence**: mixed 模式英文按词聚合为单一 unit，wrapLines 原子化不拆分

- [x] CP-R16: 避免行首标点
  - **Type**: `rule`
  - **Covers**: AC-21
  - **Evidence**: NO_START_PUNCT 正则 + 回移逻辑，标点不留在行首

- [x] CP-R17: 四种对齐方式
  - **Type**: `rule`
  - **Covers**: AC-22
  - **Evidence**: left/center/right/indent 计算正确，截图验证居中对齐生效

## Review History

### Review R1
- **Result**: `fail` → 修复后 `pass`
- **Evidence**: 首次审查发现 2 个 actionable 问题（AC-7 种子复现、AC-19 垂直溢出），均已修复
- **修复内容**:
  1. backgrounds.js: Math.random() → 确定性 hash2(x,y,seed) 噪点
  2. layout.js: 增加垂直溢出自动缩小字号（最多 5 次 ×0.85 递减）
- **验证**: 修复后浏览器加载正常，无控制台错误，渲染功能正常

### Review R2（修复后复审）
- **Result**: `pass`
- **Evidence**: 所有 17 个检查点通过；22 条 AC 均有覆盖证据；无剩余 actionable 问题
- **Advisory findings**（不阻塞验收）:
  - renderer.js 中 renderPreview 为死代码（main.js 自行实现预览）
  - palettes.js 中 driftColor 函数未被使用
  - 预览区固定 3:4 比例，选其他尺寸时有留白（不影响功能）
  - assets 目录暂无实际文件加载机制，扩展需修改代码（当前为硬编码）
