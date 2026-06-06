# VideoMark 功能增强设计文档

> **日期**: 2025-01-15  
> **范围**: 备注框恢复 + 截图预览改进  
> **状态**: 待审核

---

## 1. 需求概述

### 1.1 背景
VideoMark 当前在视频页面标记时间点后，仅显示一个短暂的 Toast 提示（"已标记: 12:34"），用户没有机会在标记瞬间记录**为什么**标记这个时间点。这与 MarkFlow 不同——MarkFlow 标记的是有语义的文本，而视频时间点本身没有语义，必须依赖备注阐述其意义。

同时，当前截图预览仅在 sidepanel 内以小尺寸展示，受限于侧边栏宽度，用户无法看清截图细节。

### 1.2 目标
- **备注框**: 标记成功后弹出可输入备注的弹框，让用户立即记录标记意图
- **截图预览**: 点击截图后在网页区域全屏预览，不再受 sidepanel 尺寸限制

---

## 2. 备注框设计

### 2.1 为什么不需要颜色、标签配置

| 维度 | MarkFlow | VideoMark |
|------|----------|-----------|
| **标记对象** | 文本内容（有语义） | 时间点（无语义） |
| **分类需求** | 需要对不同类别文本进行区分（重点/疑问/引用） | 时间点本身无类别属性 |
| **使用场景** | 阅读完成后，有时间做分类 | 观看过程中，需最小化交互步骤 |
| **视觉标识** | 页面内高亮块本身需要颜色区分 | 底部轨道已统一用蓝色锚点标识 |

引入颜色和标签会：
1. 打断用户观看流程（观看中不宜做复杂分类）
2. 让轨道视觉混乱（不同颜色锚点失去一致性）
3. 增加 sidepanel 分类管理的复杂度
4. 偏离当前核心痛点（备注缺失）

**结论**: 保持极简，仅提供备注文本输入。颜色、标签作为第二阶段扩展。

### 2.2 配置选项

在 `settings.ts` 中新增配置项：

```typescript
notePopupStrategy: 'always' | 'never' | 'skip-fullscreen' // 默认 'always'
```

| 策略值 | 行为 |
|--------|------|
| `always` | 无论是否全屏，标记后都弹框 |
| `never` | 一律不弹框（保持现状行为） |
| `skip-fullscreen` | 仅全屏状态不弹框，非全屏时弹框 |

### 2.3 交互设计

**触发时机**:
- 用户按下 `Ctrl+Shift+L` → `saveVideoMark()` 成功 → 根据配置决定是否弹框

**弹框 UI**:
- 宽度: 320px
- 默认位置: 视窗下方水平居中，距离底部 120px（避免遮挡字幕区域）
- 支持任意方向拖动（通过标题栏拖动）
- 拖动时进行边界检查（不超出视口范围）

**内容区域**:
```
┌─────────────────────────────┐
│  [拖动把手]  VideoMark    ✕ │  ← 标题栏可拖动
├─────────────────────────────┤
│  已标记: 12:34              │  ← 显示当前标记时间点
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │ 记录为什么标记这个     │  │  ← textarea 自动聚焦
│  │ 时间点...              │  │
│  └───────────────────────┘  │
├─────────────────────────────┤
│  [取消]        [保存备注]   │
└─────────────────────────────┘
```

**快捷键**:
- `Enter`（或 `Ctrl+Enter`）: 保存备注
- `Escape`: 关闭弹框（不保存）

### 2.4 数据流

```
用户按下 Ctrl+Shift+L
    ↓
saveVideoMark() 创建标记
    ↓
检查配置: notePopupStrategy
    ├─ 'never' → 结束（显示 Toast）
    ├─ 'skip-fullscreen' + 全屏 → 结束（显示 Toast）
    └─ 其他 → 弹出备注框
              ↓
        用户输入备注
              ↓
        点击保存 → 发送 update-mark-details 消息
              ↓
        background 更新 mark.note
              ↓
        弹框关闭，显示成功提示
```

### 2.5 实现要点

- **拖动实现**: mousedown 记录偏移量 → mousemove 更新位置（边界检查）→ mouseup 结束
- **边界检查**: left ≥ 0, top ≥ 0, right ≤ window.innerWidth, bottom ≤ window.innerHeight
- **全屏检测**: `document.fullscreenElement !== null`
- **自动聚焦**: 弹框显示后 `nextTick(() => textarea.focus())`

---

## 3. 截图预览改进

### 3.1 问题现状
当前截图预览逻辑在 `MarkItem.vue` 中：
```vue
<div v-if="previewImage" class="fixed inset-0 bg-black/80 ...">
  <img :src="previewImage" class="max-w-full max-h-full ...">
</div>
```

**问题**: 这个 overlay 渲染在 sidepanel 内部，sidepanel 宽度通常只有 300-400px，导致即使图片最大化显示，仍然很小。

### 3.2 改进方案

**新方案**: 将预览移至**网页区域**（content script），利用整个浏览器窗口空间。

**触发流程**:
```
sidepanel 中点击截图
    ↓
发送消息: show-screenshot-preview
    ↓
content script 接收消息
    ↓
在页面 body 中插入全屏遮罩层 overlay
    ↓
显示放大后的截图（最大 90vw × 90vh）
    ↓
点击遮罩或按 Escape 关闭
```

**UI 设计**:
- 全屏黑色半透明遮罩层（`bg-black/90`，z-index: 99999）
- 图片居中显示，限制最大尺寸为 `90vw × 90vh`
- 图片下方显示标记信息：时间点 + 备注（如果有）
- 右上角关闭按钮（×）
- 支持键盘 `Escape` 关闭

**关闭旧逻辑**: 移除 `MarkItem.vue` 中的 `previewImage` overlay，改为发送消息。

---

## 4. 文件变更清单

### 4.1 新增文件

| 文件路径 | 说明 |
|----------|------|
| `src/contentScripts/views/VideoMarkTooltip.vue` | 备注框组件（可拖动 overlay） |
| `src/contentScripts/views/ScreenshotPreview.vue` | 截图预览全屏 overlay 组件 |
| `src/contentScripts/ui.ts` | UI 管理器（创建/销毁 overlay，参考 MarkFlow ui.ts） |

### 4.2 修改文件

| 文件路径 | 变更内容 |
|----------|----------|
| `src/logic/settings.ts` | 添加 `notePopupStrategy` 配置项（默认值 `'always'`） |
| `src/contentScripts/videoMarker.ts` | `saveVideoMark()` 成功后调用弹框逻辑 |
| `src/contentScripts/index.ts` | 注册新消息处理器（show-screenshot-preview） |
| `src/sidepanel/components/MarkItem.vue` | 截图点击改为发送消息，移除旧的 previewImage overlay |
| `src/options/` | （可选）在设置页面添加弹框策略下拉选项 |

### 4.3 技术栈

- Vue 3 Composition API（与现有代码保持一致）
- webext-bridge 消息通信
- 纯 DOM 操作实现拖动（不引入新依赖）

---

## 5. 验收标准

### 5.1 备注框

- [ ] 按下 `Ctrl+Shift+L` 标记成功后，根据配置弹出/不弹出备注框
- [ ] 弹框默认出现在视窗下方水平居中位置，距离底部 120px
- [ ] 弹框支持通过标题栏任意方向拖动
- [ ] 拖动时不超出视口边界
- [ ] 弹框内 textarea 自动聚焦
- [ ] `Escape` 关闭弹框（不保存）
- [ ] `Enter` 或 `Ctrl+Enter` 保存备注并关闭
- [ ] 保存后 mark.note 被正确更新
- [ ] 全屏状态下根据配置决定是否弹框
- [ ] Toast 提示仍然显示（与弹框不冲突）

### 5.2 截图预览

- [ ] sidepanel 中点击截图后，在网页区域显示全屏遮罩层
- [ ] 图片居中显示，最大 90vw × 90vh
- [ ] 显示标记时间点和备注信息
- [ ] 点击遮罩任意位置关闭
- [ ] 按 `Escape` 关闭
- [ ] sidepanel 中不再显示旧的预览 overlay

---

## 6. 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 弹框遮挡视频字幕 | 中 | 默认位置距离底部 120px，可拖动调整 |
| 拖动实现与页面其他元素冲突 | 低 | 使用固定定位，z-index 足够高 |
| 全屏状态下无法显示弹框（浏览器限制） | 低 | 提供 `skip-fullscreen` 配置选项 |
| 消息通信失败导致预览不显示 | 低 | 添加错误处理和降级逻辑 |

---

## 7. 后续扩展（第二阶段）

- **颜色配置**: 允许用户为视频标记选择不同颜色（轨道锚点颜色同步变更）
- **标签支持**: 视频标记支持关联标签（需重构 sidepanel 标签树展示逻辑）
- **弹框模板**: 支持用户设置常用备注模板，快速选择
- **预览增强**: 支持缩放、下载截图、前后标记切换

---

*设计文档完成，等待审核。*
