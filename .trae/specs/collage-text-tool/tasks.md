# 拼贴文字工具 - Implementation Plan

## Task 1: 项目脚手架与基础结构

* **Status**: `completed`

* **Priority**: high

* **Depends On**: None

* **Description**:

  * 创建项目目录结构：`index.html`、`css/`、`js/`、`assets/fonts/`、`assets/palettes/`、`assets/textures/`

  * 创建基础 HTML 页面骨架（移动端优先的 viewport、语义化结构）

  * 创建 CSS 基础样式文件

  * 创建 JS 模块目录和入口文件

  * 配置本地开发服务器（用于预览）

* **Acceptance Criteria Addressed**: AC-12, AC-13, AC-15, AC-16, AC-17

* **Test Requirements**:

  * `rule` TR-1.1: 项目目录结构包含 index.html、css/、js/、assets/fonts/、assets/palettes/、assets/textures/；证据：检查目录列表

  * `rule` TR-1.2: index.html 在浏览器中可正常加载，无控制台报错；证据：浏览器打开页面检查

  * `rule` TR-1.3: assets 三个子目录（fonts/palettes/textures）存在且为空占位；证据：检查目录

## Task 2: 种子随机数生成器（RNG）

* **Status**: `completed`

* **Priority**: high

* **Depends On**: Task 1

* **Description**:

  * 实现 Mulberry32 或类似的种子化伪随机数生成器

  * 提供 `seededRandom(seed)` 工厂函数，返回可复用的 random() 函数

  * 支持基于位置索引的派生随机（确保样式按位置分配）

  * 提供 range(min, max)、int(min, max)、pick(array)、chance(p) 等辅助方法

* **Acceptance Criteria Addressed**: AC-7, AC-8

* **Test Requirements**:

  * `rule` TR-2.1: 相同种子产生相同随机序列；证据：console 输出两次相同种子的前10个随机数对比

  * `rule` TR-2.2: 不同种子产生不同随机序列；证据：对比两个不同种子的输出

  * `rule` TR-2.3: range/int/pick/chance 辅助函数行为正确；证据：单元测试输出

## Task 3: 文本分词模块

* **Status**: `completed`

* **Priority**: high

* **Depends On**: Task 1

* **Description**:

  * 实现 `segmentText(text, mode)` 函数

  * 三种模式：逐字（per-char）、混合（mixed，默认）、逐词（per-word）

  * 逐字：每个字符单独成片（含英文逐字母）

  * 混合：中文逐字 + 英文/数字连续按词成片

  * 逐词：按空格分组，不做自动中文分词

  * 返回分词结果数组，每个元素包含文本内容和原始位置索引

* **Acceptance Criteria Addressed**: AC-1

* **Test Requirements**:

  * `rule` TR-3.1: 逐字模式下 "Hello 你好123" 分词为 \['H','e','l','l','o','你','好','1','2','3']；证据：函数输出

  * `rule` TR-3.2: 混合模式下 "Hello 你好123" 分词为 \['Hello','你','好','123']；证据：函数输出

  * `rule` TR-3.3: 逐词模式下 "你好 world 测试" 分词为 \['你好','world','测试']；证据：函数输出

  * `rule` TR-3.4: 每个分词结果携带原始位置索引；证据：检查返回结构

## Task 4: 色板配置系统

* **Status**: `completed`

* **Priority**: high

* **Depends On**: Task 1

* **Description**:

  * 创建 `assets/palettes/` 目录下的色板配置文件（JSON 格式）

  * 内置 6 套色板：复古奶油、莫兰迪灰粉、牛皮纸暖褐、朱砂红配墨蓝、低饱和糖果、黑白灰极简

  * 每套色板包含：名称、填充色数组（3-5色）、描边深色锚点（1-2色）

  * 实现 `paletteManager.js`：加载色板列表、随机选套、取色

  * 支持颜色小范围漂移（HSL 微调），受随机幅度拉条控制

* **Acceptance Criteria Addressed**: AC-9, AC-16

* **Test Requirements**:

  * `rule` TR-4.1: 6 套色板配置文件存在且格式正确；证据：检查 JSON 文件

  * `rule` TR-4.2: paletteManager 能正确加载并返回色板列表；证据：console 输出

  * `rule` TR-4.3: 同一次生成中所有颜色来自同一色板；证据：生成测试检查颜色来源

  * `rule` TR-4.4: 色板目录可直接添加新 JSON 文件扩展；证据：添加测试文件后验证加载

## Task 5: 字体管理系统

* **Status**: `completed`

* **Priority**: high

* **Depends On**: Task 1

* **Description**:

  * 创建 `assets/fonts/` 目录和字体配置文件

  * 内嵌 Noto Sans SC 400/700（Google Fonts CDN 或 @font-face）

  * 实现 `fontManager.js`：字体列表管理、字体加载等待、按索引取字体

  * 支持后续添加字体（放入文件 + 更新配置即可）

  * 提供字体加载完成的 Promise

* **Acceptance Criteria Addressed**: AC-15

* **Test Requirements**:

  * `rule` TR-5.1: 字体配置文件存在且包含至少 2 个中文字重（400/700）；证据：检查配置

  * `rule` TR-5.2: 页面加载后字体可用，Canvas 可正确渲染中文；证据：渲染测试文本截图

  * `rule` TR-5.3: 字体目录和配置独立，添加新字体只需更新配置；证据：检查代码结构

## Task 6: 背景纹理系统

* **Status**: `completed`

* **Priority**: medium

* **Depends On**: Task 1

* **Description**:

  * 创建 `assets/textures/` 目录，放置 5 个占位背景文件

  * 五种背景：笔记本纸、白纸、点线纸、牛皮纸、透明 PNG

  * 实现 `backgroundManager.js`：背景选项管理、Canvas 程序化生成纸纹（占位阶段用 CSS/Canvas 生成）

  * 笔记本纸：横线纹理；白纸：纯白微噪点；点线纸：网格点；牛皮纸：暖褐噪点；透明：无背景

  * 背景铺满画布逻辑

* **Acceptance Criteria Addressed**: AC-17

* **Test Requirements**:

  * `rule` TR-6.1: 5 种背景选项在 UI 中可用；证据：检查 UI 选项

  * `rule` TR-6.2: 每种背景在 Canvas 上正确渲染；证据：截图检查

  * `rule` TR-6.3: textures 目录有占位文件，可直接替换；证据：检查目录

## Task 7: 纸片形状生成器

* **Status**: `completed`

* **Priority**: high

* **Depends On**: Task 2

* **Description**:

  * 实现 `paper.js`：根据文字尺寸生成纸片轮廓路径

  * 四种形状：方形、平行四边形、梯形、不规则

  * 形状选择由种子 + 位置决定

  * 实现手撕边缘效果：对轮廓边缘添加抖动（控制点偏移）

  * 纸片尺寸基于文字边界框 + 内边距（确保不溢出）

  * 手撕风格参数（抖动幅度、频率）由种子传承

* **Acceptance Criteria Addressed**: AC-2, AC-4

* **Test Requirements**:

  * `rule` TR-7.1: 四种形状（方形/平行四边形/梯形/不规则）均能生成；证据：分别生成检查路径

  * `rubric` TR-7.2: 手撕边缘视觉自然度；scale 1-5；anchors 1=平直无手撕感/3=轻微抖动/5=自然手撕质感；threshold >= 4；evidence: 渲染截图

  * `rule` TR-7.3: 相同种子+位置产生相同手撕参数；证据：对比两次生成的轮廓数据

## Task 8: 排版布局引擎（不溢出保证 + 换行 + 对齐）

* **Status**: `completed`

* **Priority**: high

* **Depends On**: Task 2, Task 3, Task 7

* **Description**:

  * 实现 `layout.js`：将分词结果排版到画布有效区域

  * 计算每个字符/词的边界框（measureText）

  * 生成纸片时确保纸片尺寸 > 文字边界框 + 安全边距

  * 实现全局字号缩放：统一缩放所有拼贴单位（文字+纸片一起）

  * 实现自动换行逻辑（基于画布有效宽度）

    * 换行规则1：避免行首出现中文标点（。，、；：！？""''（）等）

    * 换行规则2：避免拆分英文单词（英文/数字连续片段整体换行）

  * 实现四种对齐方式：左对齐、右对齐、居中、首行缩进（缩进两个拼贴单位宽度）

  * 实现随机幅度控制：旋转（±12° × 幅度）、上下浮动（±0.4em × 幅度）

  * 颜色/字体/字号随机独立开关

  * 样式按位置索引分配（非按内容）

  * 透明 PNG 模式下内容在出血区内自由排版

* **Acceptance Criteria Addressed**: AC-3, AC-5, AC-6, AC-8, AC-18, AC-19, AC-20, AC-21, AC-22

* **Test Requirements**:

  * `rule` TR-8.1: 任意输入下文字完整落在纸片内，无溢出；证据：渲染中英文混合长文本，逐纸片放大检查

  * `rule` TR-8.2: 随机幅度 0% 时所有纸片无旋转、无浮动、对齐整齐；证据：设置幅度为0生成检查

  * `rule` TR-8.3: 随机幅度 100% 时旋转在 ±12° 内、浮动在 ±0.4em 内；证据：测量多纸片参数

  * `rule` TR-8.4: 改部分文字+同种子，未改位置样式不变；证据：修改文本前后对比未变位置的旋转/颜色/字体

  * `rule` TR-8.5: 全局缩放时文字和纸片同步缩放，比例不变；证据：调节缩放前后对比

  * `rule` TR-8.6: 长文本（>画布宽度）自动换行，不超出有效区域；证据：输入200字检查

  * `rule` TR-8.7: 英文单词不被拆分到两行；证据：输入含长英文单词的文本检查

  * `rule` TR-8.8: 中文标点不出现在行首；证据：输入含标点文本检查行首

  * `rule` TR-8.9: 四种对齐方式（左/右/居中/首行缩进）效果正确；证据：分别测试四种对齐

## Task 9: Canvas 渲染引擎

* **Status**: `completed`

* **Priority**: high

* **Depends On**: Task 6, Task 7, Task 8

* **Description**:

  * 实现 `renderer.js`：将排版结果绘制到 Canvas

  * 支持三种输出尺寸的 Canvas 初始化

  * 绘制顺序：背景 → 各纸片（填充→描边→文字）

  * 纸片旋转/偏移的 Canvas transform 处理

  * 文字渲染：字体、字号、颜色、居中对齐

  * 实时预览（低分辨率快速渲染）与导出渲染（全分辨率）

* **Acceptance Criteria Addressed**: AC-2, AC-3, AC-10

* **Test Requirements**:

  * `rule` TR-9.1: 三种尺寸 Canvas 正确初始化（2048²/1080×1440/1290×2796）；证据：检查 canvas.width/height

  * `rule` TR-9.2: 渲染结果中纸片、描边、文字层次正确；证据：截图检查

  * `rule` TR-9.3: 文字在纸片内居中且不溢出；证据：放大截图检查

## Task 10: 导出与下载功能

* **Status**: `completed`

* **Priority**: high

* **Depends On**: Task 9

* **Description**:

  * 实现 `export.js`：Canvas 转图片下载

  * JPG 导出（质量 92%）用于带背景选项

  * PNG 导出（无损）用于透明背景选项

  * 文件名格式：`collage_{seed}_{timestamp}.jpg/png`

  * 透明 PNG 出血处理：画布固定尺寸，内容限制在出血区内

  * 下载触发机制（移动端兼容）

* **Acceptance Criteria Addressed**: AC-10, AC-11, AC-14

* **Test Requirements**:

  * `rule` TR-10.1: 导出图片尺寸与选项一致；证据：下载后检查图片属性

  * `rule` TR-10.2: 文件名包含种子号；证据：检查下载文件名

  * `rule` TR-10.3: 透明 PNG 四周有 8% 出血区域；证据：检查 PNG alpha 通道

  * `rule` TR-10.4: JPG 质量 >= 90%；证据：检查导出参数

## Task 11: UI 控件与交互

* **Status**: `completed`

* **Priority**: high

* **Depends On**: Task 1

* **Description**:

  * 实现主界面 UI：文本输入框、成片单位选择（逐字/混合/逐词）

  * 随机幅度拉条（0-100%）

  * 全局字号缩放控件（文字和纸片一起缩放）

  * 对齐方式选择（左对齐/右对齐/居中/首行缩进）

  * 独立开关：颜色随机、字体随机、字号随机

  * 尺寸选择（正方形/3:4/壁纸）、背景选择（5种）

  * 种子号显示与输入框（可手动指定种子）

  * 重新生成按钮（换种子）、下载按钮

  * 实时预览区域

  * 所有控件变化时触发重新渲染预览

* **Acceptance Criteria Addressed**: AC-1, AC-5, AC-6, AC-7, AC-12, AC-18, AC-22

* **Test Requirements**:

  * `rule` TR-11.1: 所有 UI 控件存在且可交互；证据：浏览器检查

  * `rule` TR-11.2: 修改输入/参数后预览自动更新；证据：交互测试

  * `rule` TR-11.3: 种子号可手动输入并复现结果；证据：输入种子号生成对比

  * `rule` TR-11.4: 全局缩放控件可调节且效果实时反馈；证据：调节缩放观察预览

  * `rule` TR-11.5: 对齐方式选择控件存在且四种模式可切换；证据：检查 UI 并测试切换

## Task 12: 页面样式（ArchDaily 风格）

* **Status**: `completed`

* **Priority**: high

* **Depends On**: Task 1, Task 11

* **Description**:

  * 实现白底极简风格：大量留白、杂志式网格布局

  * 使用无衬线细字体（系统字体栈）

  * 蓝色点缀：#00308E 用于按钮、链接、强调元素

  * 移动端竖屏布局：输入区在上、预览在中、控制在下（或可折叠面板）

  * 桌面端适配：左右分栏布局

  * 触控目标 >= 44px

  * 自定义拉条、开关、选择器样式

* **Acceptance Criteria Addressed**: AC-12, AC-13

* **Test Requirements**:

  * `rubric` TR-12.1: 移动端单手操作友好度；scale 1-5；anchors 1=无法使用/3=基本可用/5=流畅；threshold >= 4；evidence: 375×812 视口截图

  * `rubric` TR-12.2: ArchDaily 风格契合度；scale 1-5；anchors 1=不符/3=部分相似/5=高度契合；threshold >= 4；evidence: 页面截图

  * `rule` TR-12.3: 蓝色 #00308E 出现在按钮/强调元素中；evidence: 检查 CSS 和渲染

## Task 13: 集成与端到端验证

* **Status**: `completed`

* **Priority**: high

* **Depends On**: Task 2, Task 3, Task 4, Task 5, Task 6, Task 7, Task 8, Task 9, Task 10, Task 11, Task 12

* **Description**:

  * 整合所有模块到 main.js，确保数据流贯通

  * 修复模块间集成问题

  * 端到端测试：输入文字 → 调整参数（缩放/对齐/幅度） → 预览 → 导出

  * 长文本测试：输入 200-500 字，验证换行、对齐、不溢出

  * 性能检查：生成时间 < 2s（< 50 字符），< 5s（≤ 500 字符）

  * 浏览器兼容检查（Chrome desktop + mobile viewport）

* **Acceptance Criteria Addressed**: AC-1 through AC-22

* **Test Requirements**:

  * `rule` TR-13.1: 完整流程可运行：输入→生成→预览→下载；证据：操作录屏或截图序列

  * `rule` TR-13.2: 控制台无报错；证据：浏览器控制台检查

  * `rule` TR-13.3: 常规输入（<50字符）生成+预览响应 < 2s；证据：计时测量

  * `rule` TR-13.4: 长文本（≤500字符）生成+预览响应 < 5s；证据：计时测量

  * `rule` TR-13.5: 长文本换行、对齐、不溢出全部正确；证据：输入长文本截图检查

***

## Completion Evidence (all tasks)

**Task 1-13 完成证据汇总**：

* 项目结构：index.html、css/style.css、js/（10个模块）、assets/{fonts,palettes,textures}/ 均已创建

* 浏览器验证：页面加载正常，控制台无应用错误（仅网络层面的 ERR\_ABORTED 为导航取消，非应用 bug）

* 分词验证：`segmentText('你好，Hello World！', 'mixed')` → `["你","好","，","Hello","World","！"]` 正确

* RNG 验证：相同种子产生相同序列，位置派生随机工作正常

* 色板验证：6 套色板内置，同次生成颜色来自同一套

* 纸片验证：四种形状（方形/平行四边形/梯形/不规则）均出现，手撕边缘可见

* 排版验证：中英文混排正确，自动换行生效，四种对齐方式（左/居中/右/首行缩进）均测试通过

* 不溢出验证：增大内边距后文字完整落在纸片内

* 渲染验证：三种尺寸 Canvas 正确初始化（1080×1440 等），背景（牛皮纸等）正确渲染

* 导出验证：文件名含种子号格式 `collage_{seed}_{timestamp}.ext`

* UI 验证：所有控件可交互，参数变化实时更新预览

* 样式验证：白底极简、蓝色 #00308E 点缀、桌面端左右分栏布局均已实现

* 端到端：输入→生成→预览→下载全流程贯通

