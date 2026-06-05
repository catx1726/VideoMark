# Spec: 视频标记功能 (Video Mark)

## 1. 需求背景

用户在观看网页视频时，经常遇到想要记录的关键时刻（经典台词、精彩画面、重要知识点）。传统方式是手动截图+记录时间，但这会中断观影体验，且事后整理麻烦。

VideoMark 解决这一痛点：用户按下快捷键即可记录当前视频时间点，事后在侧边栏统一查看、备注、回跳。

## 2. 功能需求

### 2.1 核心功能

| ID | 需求 | 优先级 | 验收标准 |
|----|------|--------|---------|
| VM-01 | 快捷键标记视频时间点 | P0 | 按下 `Alt+V` 后，获取当前 video 元素的 `currentTime`，保存为标记 |
| VM-02 | Sidepanel 展示标记列表 | P0 | 按 URL 分组，视频标记按时间升序排列，显示格式化时间 |
| VM-03 | 点击标记跳转视频时间 | P0 | 激活对应 Tab，设置 `video.currentTime = timestamp`，自动播放 |
| VM-04 | 标记备注编辑 | P0 | 复用现有文本标记的备注编辑交互 |
| VM-05 | 直播检测与特殊处理 | P0 | 检测直播（`duration === Infinity` / 平台特征），标记 `isLive=true`，禁止跳转，强制截图 |
| VM-06 | Canvas 缩略图截图 | P1 | 320×180 JPEG 0.5 质量，直播强制，点播按设置策略执行 |

### 2.2 非功能需求

| ID | 需求 | 优先级 |
|----|------|--------|
| VM-NF-01 | 快捷键全屏可用 | P0 | 使用 `chrome.commands` API，而非 content script 键盘监听 |
| VM-NF-02 | CORS 降级 | P1 | 截图失败时（SecurityError）自动降级为不截图，不阻塞标记 |
| VM-NF-03 | 多视频页面智能选择 | P1 | 按尺寸+播放状态+可视区域选择最可能的主视频 |

## 3. 数据模型

```ts
interface Mark {
  // ... 现有文本标记字段 ...

  type?: 'text' | 'video'
  timestamp?: number      // 视频时间点（秒）
  duration?: number       // 视频总时长
  isLive?: boolean        // 是否直播
  platform?: string       // 平台标识
  videoSrc?: string       // 视频源地址
  screenshot?: string     // base64 JPEG data URL
}
```

## 4. 设计决策

### 决策 1：复用现有 `Mark` 接口（已确认）

通过 `type` 字段区分文本标记和视频标记，复用存储、同步、标签树、Sidepanel 全部基础设施。

### 决策 2：`chrome.commands` 全局快捷键（已确认）

优点：视频全屏模式下仍能触发。缺点：用户需通过浏览器扩展快捷键页面修改。

### 决策 3：分层缩略图策略（已确认）

- 点播：默认不截图（可配置"始终截图"）
- 直播：强制截图
- 缩略图：320×180 JPEG quality 0.5，单张 ~15-30KB

## 5. 直播检测策略

```
Layer 1: video.duration === Infinity  → 直播
Layer 2: src 包含 .m3u8（不含 vod）  → 直播
Layer 3: 平台 DOM 特征（ytd-live-chat-frame 等） → 直播
Fallback: 保守假设为点播
```

## 6. 边界情况

- 页面无 video 元素：提示"未检测到视频"
- 多 video 元素：选择尺寸最大、正在播放的
- CORS 限制截图：捕获异常，降级为不截图
- 直播标记点击跳转：提示"直播无法回跳"，但仍跳转到页面
