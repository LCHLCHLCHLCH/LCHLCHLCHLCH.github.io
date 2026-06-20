---
title: 技术栈
date: 2025-06-05
tags: [技术, Hexo, xp.css]
---
本博客的技术选型：

## 前端

- **XP.css** — Windows XP 风格 CSS 库
- **marked.js** — Markdown 渲染（Hexo 内置）
- **EJS 模板** — Hexo 主题引擎

## 托管

- **GitHub Pages** — 免费静态托管
- `hexo generate` 一键构建，推送即上线

## 文件结构

```
├── _config.yml          ← Hexo 配置
├── source/
│   └── _posts/          ← Markdown 文章
└── themes/
    └── xp-blog/         ← 自定义 XP 主题
```

## 为什么选择 Hexo + 纯 CSS？

1. 更快的加载速度
2. 更少的 JavaScript
3. 更贴近"老式"体验

> Keep it simple.
