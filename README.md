# VideoMark

> 在任何网页视频中，一键标记精彩时刻，随时回跳回顾。

[![Firefox Add-on](https://img.shields.io/badge/Firefox-Add--on-orange)](https://addons.mozilla.org/) [![GitHub License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE) ![Local First](https://img.shields.io/badge/Storage-Local--Only-blue) ![Privacy](https://img.shields.io/badge/Privacy-No--Login-green)

---

## 它能做什么？

### 🎬 一键标记时间点

观看任意网页视频时，按下 `Ctrl+Shift+L` 瞬间记录当前时间点。YouTube、Bilibili、Twitch、抖音……只要网页里有视频，都能标记。

### 📷 智能截图

直播内容自动截图留存（直播过后无法回看），点播视频可选截图策略，省空间也能留回忆。

### 🔴 直播识别

自动检测直播流，特殊标记并提示无法跳转，避免误操作。

### 📍 精准回跳

点击侧边栏的任意标记，瞬间回到对应视频、对应时间点。3 层 URL 匹配确保不会找错视频。

---

## 快速开始

1. **安装扩展** — 从 Releases 下载或从浏览器商店安装
2. **打开任意视频网站**，播放视频
3. **按下 `Ctrl+Shift+L`** 标记当前时间点
4. **点击侧边栏**查看所有标记，点击即可回跳

> 如果快捷键冲突，可在浏览器扩展管理页面自定义。

---

## 支持平台

| 平台 | 状态 |
|------|------|
| YouTube / YouTube Live | ✅ |
| Bilibili / Bilibili 直播 | ✅ |
| Twitch | ✅ |
| 抖音 | ✅ |
| 任意 HTML5 视频网站 | ✅ |

> 部分网站（如 Netflix、Disney+）受 DRM/CORS 保护，截图功能不可用，但时间戳标记不受影响。

---

## 常见问题

**Q: 标记的数据存在哪里？**  
A: 100% 本地存储在浏览器中，无需注册，不采集任何数据。可选 GitHub Gist 同步。

**Q: 直播标记为什么截图了但无法跳转？**  
A: 直播是实时流，标记的时间点只对应当前直播时刻，直播结束后该时间点已不存在。截图就是为了让你事后还能看到那个画面。

**Q: 可以导出标记吗？**  
A: 支持通过 GitHub Gist 多端同步，标记数据以私有 Gist 形式存储。

**Q: 支持哪些浏览器？**  
A: Firefox（推荐）和 Chrome/Edge 等 Chromium 内核浏览器。

---

## 技术栈

- Vue 3 + Vite + TypeScript
- Manifest V3
- webext-bridge

---

MIT License

> _让每一个精彩时刻都有迹可循。_
