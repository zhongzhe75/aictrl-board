# AI 学习任务指挥台 · Echo CommandCore

一个用于 **整合多种 AI 输出、辅助学习与执行的前端任务管理工具**。  
通过「任务 + AI 建议归档 + 执行模式」，帮助你把 AI 的想法真正变成可执行的行动。

👉 在线 Demo：  
https://zhongzhe75.github.io/aictrl-board/

---

## ✨ 项目简介

在日常学习和做项目时，我们经常同时使用多个 AI（如 ChatGPT、Gemini、DeepSeek 等），  
但这些 AI 的输出通常是 **零散的、难以落地执行的**。

**Echo CommandCore** 的目标是：

> 把 AI 的“建议”，转化为「可规划、可执行、可回顾」的学习任务。

这是一个 **完全使用原生 HTML / CSS / JavaScript 实现的前端项目**，  
不依赖任何框架，专注于产品逻辑与交互体验。

---

## 🚀 核心功能

### 🧩 任务管理
- 新建 / 编辑 / 删除任务
- 任务状态：待办 / 进行中 / 已完成
- 优先级与时间预估
- 本地持久化（LocalStorage）

### 🤖 AI 建议归档
- 支持多种 AI 来源：
  - ChatGPT
  - DeepSeek
  - Gemini
  - Grok
  - 豆包
  - **自定义来源**
- AI 建议可绑定到具体任务
- 支持删除、排序、查看历史建议

### 🎯 执行模式（Focus Mode）
- 一次只专注一个任务
- 显示任务上下文与描述
- 强制焦点锁定，避免分心
- 支持记录「下一步行动」

### 🌗 主题与体验
- 深色 / 浅色主题切换
- 键盘友好（Tab / Esc / Enter）
- 无障碍设计（ARIA 标签）
- 响应式布局，适配不同屏幕

---

## 🛠 技术栈

- **HTML5**（语义化结构）
- **CSS3**
  - CSS Variables
  - 响应式布局
  - 无第三方 UI 框架
- **JavaScript（ES Module）**
  - 模块化拆分
  - 状态管理（store.js）
  - 事件委托
- **GitHub Pages**
  - 自动部署
  - 在线 Demo

---

## 📁 项目结构

```text
.
├── index.html        # 页面结构
├── styles/
│   └── main.css      # 全局样式与主题
├── scripts/
│   ├── app.js        # 应用入口 & 事件逻辑
│   ├── store.js      # 状态管理 & 本地存储
│   └── ui.js         # UI 渲染与工具函数
└── README.md
