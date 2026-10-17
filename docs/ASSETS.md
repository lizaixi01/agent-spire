# 当前美术资源

更新：2026-10-17。

## 教材与界面约定

唯一教材为用户提供的李博杰《深入理解 AI Agent：设计原理与工程实践》v2.0（2026-09-23），原 PDF 不随仓库或游玩包分发。知识和题目的章节、正文页码与 PDF 页码仍由 src/content.ts 维护，本轮没有改写教材内容。

首页只保留学习入口、核心公式和章节练习。出牌后直接显示对应概念及来源；装饰性英文和宣传文案已移除。品牌外观不代表模型的真实能力与排名，不改变卡牌数值或学习结论。

## 实际使用的文件

- 像素场景：public/pixel/spire.png，使用内置 image_gen 新生成，复制进项目后使用。
- Q 版角色：public/pixel/model-party.png，使用用户明确选定并提供的八角色 PNG，原样复制，保留透明通道。来源为用户提供的参考图片。原图保持四列两行，仅以 CSS 显示 OpenAI、Claude、DeepSeek 三格，对应三个固定角色。其余五格不在首页、选角或卡牌中展示，没有重新画这套角色。
- 像素敌人：public/pixel/encounters.png，使用内置 image_gen 新生成。战斗使用第二行前三格。
- 图标和品牌标志：src/icons.ts、src/models.ts 中的网格像素图形。品牌图形是像素化识别元素，不冒充官方提供的标准矢量资产。
- 字体：public/pixel/fonts/fusion-pixel.woff2，Fusion Pixel 12px proportional 简体中文，官方发行版 2026.10.16。OFL 及上游许可随文件保留。游玩时全部从本地加载。

## 品牌识别参考

[OpenAI](https://openai.com/brand/) · [Anthropic](https://www.anthropic.com/) · [Claude](https://claude.com/) · [DeepSeek](https://www.deepseek.com/) · [Grok](https://x.ai/) · [Hermes / Nous Research](https://github.com/NousResearch/hermes-agent) · [Gemini](https://gemini.google.com/) · [Qwen](https://qwen.ai/)。

字体来自 [Fusion Pixel 官方仓库](https://github.com/TakWolf/fusion-pixel-font/releases/tag/2026.10.16)。原有非像素背景、Noto 字体及停用的卡面图集仅留在本机 reference/unpublished-assets/，不随 Git 仓库和游玩包分发。

## 内置图像生成提示词

### 当前像素场景

Use case: stylized-concept. Asset type: NEW pixel-art background for the browser RPG Agent Spire. Create an exceptionally beautiful authentic 16-bit SNES era PIXEL ART landscape, 16:9 composition. A monumental ancient AI server spire rising on the right third of a rocky floating island, stepped stone architecture, tiny luminous mint circuit runes and warm orange windows, pixel bridges across cliffs, deep layered mountains, a small pale teal pixel moon in midnight blue sky, distant pixel clouds and tiny stars. Dense deliberate pixel clusters, hard stair-stepped contours, restricted 32-color palette, elegant patterned dithering, no smooth rendering, NO anti-aliasing, NO painterly brushwork, NO 3D. Native scene should feel like 480x270 pixel art enlarged with nearest-neighbor scaling. Palette midnight navy #10162a, slate #263447, mint #86e5c0, amber #f8b65d, blue #6d92cd. Make the left 48 percent atmospheric and quiet dark, for later game text overlay. Lower third has a layered detailed dark pixel stone platform and shrubs. Beautiful dramatic lighting rendered only as discrete pixel color steps. No words, no interface, no logos, no characters. Completely new art.

### 敌人所在的初版精灵表

Use case: stylized-concept. Asset type: transparent PIXEL ART SPRITE SHEET for an original retro AI-agent deckbuilding RPG. Exact layout: a clean even 4-column by 2-row grid, 8 equal square cells, each containing one complete centered separate character. Transparent background. All cells equal size, no captions or labels. Authentic highly detailed 16-bit pixel art, deliberate hard pixel clusters, dark pixel outline, 24-color shared palette, nearest-neighbor look, no antialiasing, no smooth shading. Plenty of transparent padding within each cell so no sprite touches another cell. Row 1 left-to-right: (1) a friendly mint-green hooded robot scholar with square glowing eyes, a cream open book, little brass technological details, (2) a small warm-orange crab-like Claude-inspired robot architect mascot with tiny square black eyes and bronze wizard cape, (3) a friendly blue DeepSeek-inspired whale wizard with cream belly and tiny spellbook, afloat, (4) Grok Bot-inspired small monochrome white robot explorer with black horizontal visor, small antenna, orange square utility belt. Row 2 left-to-right: (5) a purple glitch ghost made of floating pixel shards with menacing magenta eyes, (6) an ancient dark stone automaton with mint circuit patterns and orange core, (7) an imposing corrupted black-server knight boss with angular orange crown and purple eyes, (8) a Hermes-inspired robot merchant with winged bronze helmet, mint cloak and a leather satchel. Full body, three-quarter RPG battle sprite view facing slightly inward, consistent scale, each sprite within its own cell. No text, no watermarks, no UI, no floor, transparent background.

### Q 版设计探索

以下提示词曾用于参考用户的 DeepSeek 形象探索八角色方案；最终实际接入的是用户随后明确选定的 PNG。

Use case: stylized-concept. Asset type: brand-new transparent sprite sheet for a PIXEL ART RPG. The attached image is a CHARACTER DESIGN REFERENCE ONLY for DeepSeek (the fourth character): preserve its recognizable blue long hair, blue eyes, white frilled maid headdress, blue bows, modest navy-and-white maid dress with little whale emblem on apron, small fins and curved whale tail, big joyful eyes. Convert that design language into authentic high quality 16-bit chibi pixel sprites. Create EIGHT different extremely cute HUMANOID ANIME CHIBI model mascot characters, all 2.5 heads tall, big heads, tiny complete bodies, expressive faces, fully clothed, innocent and whimsical, not robot machines and not animal-only bodies. Exact even grid layout FOUR COLUMNS by TWO ROWS, ONE full centered character per equal rectangular cell, top and bottom rows aligned, generous transparent padding, NO overlap, NO names or text, NO labels, NO floor, truly transparent background. Native pixel-sprite feeling ~80x100 pixels per character enlarged with nearest neighbor: deliberate square pixel clusters, hard stepped outline and discrete shading, NO antialiasing, NO painted smooth gradients, NO blurry or vector art. Row 1 left to right: 1 OPENAI-inspired mint-haired cheerful young scholar girl wearing cream and emerald mage cloak, small six-loop white knot hair ornament, holds a little glowing green book. 2 ANTHROPIC-inspired cream-haired bespectacled archivist girl in dark ink and sand librarian coat, angular A-shaped hair clip, scroll and leather book. 3 CLAUDE-inspired apricot orange-haired smiling girl in peach cape, sunburst hair ornament, a tiny cute orange crab companion on her shoulder, holds quill. 4 DEEPSEEK girl based on reference, blue long hair white frilly maid headpiece blue bows navy maid dress small whale on white apron and blue whale tail. Row 2 left to right: 5 GROK BOT-inspired silver-haired mischievous chibi boy in black-white space explorer jacket, black X hair ornament and small white robot companion, cute rather than intimidating. 6 HERMES-inspired golden-haired courier boy in teal cloak and winged brass cap with messenger satchel and little winged staff. 7 GEMINI-inspired lavender and blue twin-tailed star mage girl with four-point star hair clip and purple-blue robe. 8 QWEN-inspired purple-haired cheerful girl with violet geometric hair ornament, white-violet futuristic scholar outfit and a floating triangular crystal. Cohesive palette and consistent scale across all eight. Crisp detailed retro JRPG character roster suitable for game combat and character selection. Pixel art must remain clearly visible. Do NOT copy the watermark or any text from reference. Wide 2:1 canvas with perfectly even 4x2 grid.


## 历史版本：知识场景插图、音乐与特效（卡面图集已停用）

- 两张新增卡面图集：public/pixel/cards-cognition.png 与 public/pixel/cards-practice.png。均使用内置 image_gen 新生成，原样复制到项目；每张图集四列四行，共 32 幅独立概念插图，CSS 定位，不依赖远程图片。最终完整提示词保存在 [card-art-prompts.json](card-art-prompts.json)。
- 图意映射见 src/card-art.ts；上下文屏障显示有限窗口中的卷轴，RAG 显示可追溯证据检索，工具调用显示工具插槽。插图只是教学隐喻，知识解释和页码继续由 src/content.ts 提供，未改动题目与战斗数值。
- 音乐由 src/audio.ts 内的原创 A 小调音序在浏览器本地合成，92 BPM，32 拍循环，三角波旋律/低音与柔和和声；无外部录音、无远程音频、无音频素材授权依赖。音效按攻击、格挡、技能和能力区分。默认低音量，首次操作后播放；两个独立开关、音量与静音偏好持久保存，隐藏页面暂停。
- 出牌动画为 CSS 像素斩击、护盾、符文与卡面飞行；浮字按有效行动前后的实际状态生成，不把牌面伤害误写成实际掉血。弹窗打开时隐藏战斗特效，系统减少动态效果时只保留简短静态数值。

## 当前版本：简约知识符号与分层命中

- 当前所有卡面改用 src/card-art.ts 与 src/icons.ts 的单色网格像素符号，沿用项目原生 SVG 图标系统。没有新生成或编辑位图；旧的 cards-cognition.png 与 cards-practice.png 仅作为历史资源保留，当前页面不加载。
- 一个卡面只保留一个概念符号与类型强调色，移除角落重复图标和插画纹理。Q 版三角色、敌人与塔背景继续使用原资源。
- 命中音效仍由本地 Web Audio 合成：低频瞬态、短促高频、连携上行音、击杀下行音和胜利琶音分层组合，无外部录音。
- 重击/连携/击杀的短震屏与普通攻击的局部受击分开；设备支持时使用短振动。系统减少动态效果时取消震屏、位移与粒子，保留简短数值反馈。
- 桌面拖牌使用原生指针事件和简洁虚线瞄准，触屏保留滑动手牌；松手无效目标或 Esc 取消不消耗牌。最后击杀在存档状态已提交后短暂呈现消散。


2026-10-17 更新：实现试炼通关使用程序生成的像素粒子、奖励道具符号、聚光与原生 Web Audio 上行和弦，无新增外部音视频资源。受击提示按真实结算显示红色边缘、格挡量和伤害量；强震提高到约 430ms，系统减少动态效果时保留静态文字提示。

## 轻量发布（2026-10-17）

发布仅包含三张实际使用的 PNG、Fusion Pixel 字体及许可、应用代码。音乐与卡面使用浏览器合成和原生 SVG，不下载额外素材。历史插画提示词保留供溯源，所述停用文件不包含于发布内容。用户提供的角色图保留原样，其原始作者和独立再分发许可尚未核实；品牌权利归各权利人所有，不将这些素材宣称为 MIT 授权资产。仓库暂未授予统一开源许可。

v0.1.2 的命中音效以浏览器振荡器及程序噪声合成，配合动态压缩器限制峰值；粒子、闪光、血条与逐拍镜头使用 DOM/CSS/Web Animations。没有新增位图、音视频文件或运行时 npm 依赖。
