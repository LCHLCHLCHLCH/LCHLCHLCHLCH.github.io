---
title: 技术栈
date: 2025-06-05
tags: [技术, Hexo, xp.css, EJS, 设计]
---
本博客从一张空白 HTML 起步，历经桌面模拟器和 Hexo 两季重构。这里记录当前版本的技术选型、架构决策和每一层的取舍。

---

## 整体架构

```text
source/_posts/*.md          ←  Markdown 文章（你写的）
        │
        ▼
      Hexo                    ←  静态站点生成器
        │
        ▼
themes/xp-blog/              ←  自定义主题（EJS 模板 + CSS）
        │
        ▼
docs/                        ←  构建输出（纯静态 HTML/CSS/图片）
        │
        ▼
GitHub Pages                 ←  托管 & CDN
```

一条线走到底：写完 Markdown，`npm run build`，推送，上线。没有数据库，没有后端服务，没有运行时。

---

## Hexo：静态站点生成器

### 为什么选 Hexo

静态站点生成器（SSG）的选择很多 —— Jekyll、Hugo、Gatsby、Astro、Next.js…… 选 Hexo 有几个原因：

| 考量 | Hexo 的表现 |
|---|---|
| **语言** | Node.js 生态，npm 安装，对前端开发者友好 |
| **模板引擎** | 支持 EJS / Pug / Nunjucks 等多种，EJS 最接近纯 HTML |
| **主题系统** | 每个主题是一个独立目录，结构与项目分离，方便定制 |
| **生成速度** | 中等站点毫秒级；本博客 5 篇文章 29 个文件，<30ms 完成 |
| **Markdown 渲染** | 内置 marked.js，GFM 表格/代码块/任务列表均可渲染 |
| **插件生态** | 归档、标签、分类、分页等常用功能有官方插件 |
| **学习成本** | 极低。`hexo init` → 写 md → `hexo generate` |

相比之下：Jekyll 需要 Ruby 环境，Gatsby/Next 对纯内容站点太重，Hugo 的模板语法（Go template）不够直观。Hexo 在"简单"和"够用"之间恰好踩中了平衡点。

### Hexo 工作流

```
hexo new "文章标题"        →  在 source/_posts/ 创建 标题.md
hexo server                →  本地预览 localhost:4000，支持热重载
hexo generate              →  构建到 docs/ 目录
hexo clean                 →  清除缓存和构建输出
```

实际日常只需要两条命令：`hexo server` 本地写文章，写完 `npm run build && git push` 上线。`hexo new` 会按照 `scaffolds/post.md` 模板自动填入 Front Matter 骨架：

```yaml
---
title: {{ title }}
date: {{ date }}
tags:
---
```

### Hexo 的核心概念

**Front Matter**：每篇 `.md` 文件顶部的 YAML 块，定义文章的元数据。Hexo 解析它来决定文章标题、日期、标签、分类、永久链接等。模板中通过 `page.title`、`page.date`、`page.tags` 等变量访问。

**Scaffolds**：文章模板。`scaffolds/post.md` 定义了新文章的默认 Front Matter，`hexo new` 时自动套用。

**Source vs Public**：`source/` 是你编辑的源文件，`docs/`（原 `public/`）是构建产物。两者之间是单向编译 —— 永远不要在 `docs/` 里手动改东西。

---

## XP.css：Windows XP 的 CSS 复刻

### 它是什么

[XP.css](https://botoxparty.github.io/XP.css/) 是一个纯 CSS 库，用现代 CSS 技术逐像素还原了 Windows XP 的 Luna 主题视觉。没有一行 JavaScript，所有组件都是原生 HTML 元素加上特定类名。

### 核心组件

| 组件 | HTML 结构 | 本博客用途 |
|---|---|---|
| **Window** | `.window > .title-bar + .window-body` | 每一个"窗口"：导航栏、作者卡片、文章正文、TOC、最新文章、状态栏 |
| **Title Bar** | `.title-bar > .title-bar-text` + `.title-bar-controls > button` | 窗口标题栏，蓝白渐变是 Luna 的灵魂 |
| **Button** | `<button>` | 导航按钮、分页按钮、文章卡片中的链接 |
| **Status Bar** | `.status-bar > .status-bar-field` | 底部状态栏 |
| **Tree View** | `ul.tree-view > li` | TOC 目录树（可折叠展开） |
| **Checkbox / Radio** | `<input type="checkbox">` | 原生 XP 风格表单控件 |
| **Fieldset** | `<fieldset> <legend>` | （预留）分组框 |

标题栏的蓝白渐变是 XP.css 最核心的视觉资产：

```css
background: linear-gradient(180deg,
  #0997ff 0%, #0053ee 8%, #0050ee 40%,
  #0066ff 88%, #005bff 95%, #003dd7 100%
);
```

上半高光、下半深蓝，配合右上角三个按钮（最小化/最大化/关闭），一看到就回到 2002 年。

### 窗口凸起边框

XP 的窗口边框不是简单的 1px 线条，而是用多层 `box-shadow` 模拟的立体凹槽效果：

```css
.window {
  box-shadow: inset -1px -1px #0a0a0a, inset 1px 1px #dfdfdf,
              inset -2px -2px grey, inset 2px 2px #fff;
}
```

这个"内阴影浮雕边框"是 XP 窗口区别于扁平化设计的核心特征。本博客的文章卡片 (`post-card`) 复用了同样的 `box-shadow`，让列表项也有 XP 凸起按钮的质感。

### 为什么用 CDN 而不是打包

主题配置 `use_cdn: true`，从 `unpkg.com/xp.css` 加载。原因很简单：

- xp.css 是纯 CSS，没有构建环节，CDN 直链零开销
- 文件小（~30KB gzipped），unpkg + jsDelivr 双 CDN 保障
- 不需要跟着项目一起编译，升级只需改版本号

如果哪天 CDN 不可用，`use_cdn: false` 即可切到本地打包。

---

## 自定义主题：xp-blog

### 主题结构

```
themes/xp-blog/
├── _config.yml                 ←  主题级配置（导航、作者、CDN 开关）
├── layout/
│   ├── layout.ejs              ←  页面骨架（HTML5 + Bliss 背景 + 桌面容器）
│   ├── index.ejs               ←  首页：文章列表 + 分页
│   ├── post.ejs                ←  文章详情：窗口包裹正文 + 元信息 + 版权
│   ├── page.ejs                ←  独立页面（"关于"等）
│   ├── archive.ejs             ←  归档：按年月分组
│   └── _partial/
│       ├── head.ejs            ←  <head> 标签（meta、CDN、SEO）
│       ├── header.ejs          ←  顶部导航栏（XP 窗口包裹的按钮组）
│       ├── footer.ejs          ←  底部状态栏窗口
│       ├── sidebar-left.ejs    ←  左侧栏：作者卡片窗口
│       ├── sidebar-right.ejs   ←  右侧栏：TOC 窗口 + 最新文章窗口
│       ├── post-card.ejs       ←  文章列表卡片（凸起按钮风格）
│       └── post-meta.ejs       ←  文章元信息行（日期/分类/字数/标签）
├── scripts/
│   └── toc-helper.js           ←  Hexo 辅助函数（TOC 生成/字数/阅读时间）
└── source/
    ├── css/style.css           ←  370 行主题样式
    └── images/                 ←  bliss.jpg、avatar.jpg、XP 图标
```

### 三栏多窗口布局

从参考博客（wenjie-astro）获得启发，采用了 **Grid 三栏 + 每块独立 XP 窗口** 的设计：

```text
┌──────────────────────────────────────────────────────┐
│  [导航栏窗口]  Home  Archives  Tags  About    [_][□][×] │
├─────────┬────────────────────────────┬───────────────┤
│ [作者]  │                            │ [目录]         │
│ 头像    │  [文章窗口]                │  tree-view     │
│ LCH     │                            │                │
│ 统计    │  正文内容在这里             │ [最新文章]     │
│ 格言    │                            │  文章1         │
│         │                            │  文章2         │
│         │                            │  ...           │
├─────────┴────────────────────────────┴───────────────┤
│  [状态栏窗口]  © LCH · Powered by Hexo & xp.css       │
└──────────────────────────────────────────────────────┘
```

Grid 参数：`grid-template-columns: 260px 1fr 280px`，gap: 14px，最大宽度 1480px，居中。在 1100px 以下折叠为单栏，侧边栏移到文章下方。

每个"窗口"的标题栏按钮（最小化/最大化/关闭）是纯装饰性的——`pointer-events: none`。既保持了 XP 视觉完整性，又不误导用户以为它们真的可交互。

### EJS 模板引擎

Hexo 默认支持 EJS（Embedded JavaScript），语法就是 `<% ... %>` 里写 JS。比如文章列表的渲染逻辑：

```ejs
<% page.posts.each(function(post) { %>
  <%- partial('_partial/post-card', { post: post }) %>
<% }) %>
```

`partial()` 引入子模板，传参清晰。和 React/Vue 的组件化异曲同工，但不需要任何构建工具——Hexo 在生成阶段直接执行 EJS，输出纯 HTML。

### 自定义辅助函数

Hexo 的 EJS 模板本身不提供目录生成、字数统计、阅读时间估计等功能。通过 `scripts/toc-helper.js` 注册了三个辅助函数：

**`toc(content)`**：解析文章 HTML 中的 `&lt;h1&gt;` 到 `&lt;h3&gt;` 标签，用栈追踪嵌套层级，生成 xp.css 的 `&lt;ul class="tree-view"&gt;` 结构。处理了跳过级别（直接 h1→h3）、兄弟标题并列、深度回退等边界情况。生成的树状目录自带折叠展开功能。

**`word_count(content)`**：去除 HTML 标签和空白后计算纯文本长度，中文按字符数算（因为中文没有空格分词）。

**`reading_time(content)`**：字数 ÷ 300 ≈ 阅读分钟数，最少显示 1 分钟。

这三个函数通过 `hexo.extend.helper.register()` 注册后，模板里可以直接调用：

```ejs
<%= toc(post.content) %>
<%= word_count(post.content) %> 字 · 阅读约 <%= reading_time(post.content) %> 分钟
```

---

## 样式系统

### CSS 自定义属性

使用了两个 CSS 自定义属性来控制文章正文的表现：

```css
.post-content {
  font-size: var(--content-font-size, 15px);
  user-select: var(--content-select, text);
}
```

这是从第一季桌面模拟器遗留下来的设计——控制面板里的字体大小滑块和文字可选开关就是通过这两个变量实现的。在 Hexo 版本中，它们被保留但没有 UI 调节入口（默认值直接写在 CSS 里），为将来可能的设置面板留下接口。

### Bliss 壁纸

桌面背景使用了真正的 `bliss.jpg`——那张 Charles O'Rear 在加州索诺玛县拍下的照片：

```css
.desktop-bg {
  position: fixed; inset: 0; z-index: -1;
  background: url('/images/bliss.jpg') center/cover no-repeat;
  background-color: #3a6bc5;  /* 图片加载前的兜底色 */
}
```

`position: fixed` 保持背景不随滚动移动，`cover` 保证填满整个屏幕，`z-index: -1` 让所有窗口浮在壁纸之上。

### 响应式策略

不是 mobile-first 也不是 desktop-first，而是按内容可读性来决定断点。核心逻辑：

- **> 1100px**：三栏 Grid 桌面布局，侧边栏在左右，代码块用横向滚动条
- **≤ 1100px**：单栏堆叠，侧边栏移到文章下方，代码块强制折行

断点 1100px 的由来：Grid 列 `260px + 1fr + 280px` = 侧边栏固定 540px + gap 28px + 容器内边距 36px = 至少 604px 被固定占走；剩余宽度给中栏放代码块。1100 - 604 = 496px，大约能装下 65 个等宽字符（~7.6px/char），对大多数代码片段够用。低于这个宽度就折叠，保证阅读体验。

---

## Markdown 渲染管线

Hexo 默认使用 `hexo-renderer-marked`（基于 marked.js）渲染 Markdown。支持的语法：

| 语法 | 渲染结果 |
|---|---|
| `# ## ###` 标题 | `&lt;h1&gt;` ~ `&lt;h6&gt;`，自动生成 `id`，供 TOC 锚点跳转 |
| `**粗体**` / `*斜体*` | `&lt;strong&gt;` / `&lt;em&gt;` |
| `` `行内代码` `` | `&lt;code&gt;` — 灰底等宽字体 |
| ` ``` 围栏代码块 ``` ` | `&lt;pre&gt;&lt;code&gt;` — 黑底银字终端风格 |
| `> 引用` | `&lt;blockquote&gt;` — 左侧蓝色竖线 + 灰底 |
| `| 表格 |` | `&lt;table&gt;` — XP 风格边框 |
| `- 无序列表` / `1. 有序列表` | `&lt;ul&gt;` / `&lt;ol&gt;` |
| `[链接](url)` | `&lt;a&gt;` — 蓝色 / 访问后紫色 |
| `![图片](url)` | `&lt;img&gt;` — `max-width: 100%` 自觉不溢出 |

Hexo 的 `highlight.enable: true` 配合 marked 可以给代码块加语法高亮，但目前保持默认关闭状态——代码块只有银字黑底，没有彩色标记。一方面是风格统一（XP 的记事本也没有语法高亮），另一方面是减少 CSS 体积。

---

## 部署：GitHub Pages

### 发布流程

```bash
npm run build      # hexo generate → docs/
git add -A
git commit -m "..."
git push origin main
```

GitHub Pages 设置为从 `docs/` 目录提供内容，推送后约 30 秒即可在 `lchlchlchlch.github.io` 看到更新。

### 为什么是 docs/ 而不是 public/

因为 GitHub Pages 的源目录选项只有两个：`/(root)` 和 `/docs`。不存在 `public/` 选项。所以 Hexo 配置中设 `public_dir: docs`，构建直接输出到 `docs/`，省去复制或 GitHub Actions 步骤。

### 没有 CI/CD

对于一个单人次更新的博客来说，本地 `hexo generate` + `git push` 足够简单。不需要 GitHub Actions 在云端跑构建——每次推送的只是纯静态 HTML，不涉及编译环境、依赖安装或安全密钥。

---

## 和第一季桌面模拟器的关系

第一季是一个完整的 Windows XP 桌面模拟器：桌面图标、可拖拽缩放最大化的窗口管理器（~600 行 JS）、资源管理器、控制面板、IE 浏览器。它被剥离了，但留下了几个设计遗产：

| 第一季 | 第二季（现在） |
|---|---|
| 桌面 Bliss 渐变 → | 真正 bliss.jpg 壁纸 |
| 窗口管理器 → | 静态多窗口布局（纯 CSS Grid） |
| `--content-font-size` 变量 → | 保留在 CSS 中（无 UI） |
| 图标系统 → | 窗口标题栏图标（传真封面、信息、XML 等） |
| 字体大小滑块 → | 响应式字号 + CSS 变量 |
| `marked.js` 前端渲染 → | Hexo 后端预渲染 |

本质的取舍：**交互性 vs 简单性**。桌面模拟器好玩但不实用（SEO 为零、JS 太重、文章管理痛苦），Hexo 版本放弃了可拖拽窗口，换来了真正的博客功能。

---

## 没有用到的技术（以及为什么不）

| 技术 | 为什么不 |
|---|---|
| **React / Vue** | 纯静态博客不需要运行时框架 |
| **Tailwind CSS** | XP.css 已经提供了所有需要的组件样式 |
| **TypeScript** | Hexo 脚本只有 100 行，JS 足够 |
| **数据库 / CMS** | 静态文件 + Git 版本控制比任何 CMS 都简单 |
| **评论系统** | 保持纯粹；将来可能通过 GitHub Issues 接入 |
| **RSS** | Hexo 有 `hexo-generator-feed` 插件，需要时一行配置即可开启 |
| **搜索** | 5 篇文章不需要搜索；将来文章多了可以加 `hexo-generator-search` |

---

## 文件清单（最终形态）

```
LCHLCHLCHLCH.github.io/
├── _config.yml              ←  Hexo 全局配置
├── package.json             ←  依赖：hexo 7.x + 官方插件 + xp.css
├── scaffolds/
│   ├── post.md              ←  新文章模板
│   └── page.md              ←  新页面模板
├── source/
│   ├── _posts/              ←  Markdown 源文章
│   │   ├── hello.md
│   │   ├── about-xp.md
│   │   ├── tech-stack.md
│   │   ├── furong-nuer-lei.md
│   │   └── dev-history.md
│   └── about/
│       └── index.md         ←  "关于"页面
├── themes/xp-blog/          ←  自定义主题（见上文详解）
├── docs/                    ←  构建输出（GitHub Pages 源）
├── .gitignore               ←  node_modules + lock 文件
└── node_modules/            ←  不提交
```

---

> 技术选型没有银弹。Hexo + xp.css + EJS 这套组合不是最酷的，也不是最快的，但它是"刚好够用"的——每一层都看得懂、改得动、不锁死。对一个个人博客来说，这比什么都重要。
