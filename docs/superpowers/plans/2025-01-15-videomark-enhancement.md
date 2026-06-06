# VideoMark 功能增强实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 VideoMark 中添加备注框弹窗功能和改进截图预览体验

**Architecture:** 通过 Content Script 创建可拖动的 DOM overlay 实现备注框，通过消息通信将截图预览从 sidepanel 移至网页区域

**Tech Stack:** Vue 3, webext-bridge, TypeScript, TailwindCSS (via UnoCSS)

---

## 文件变更总览

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/contentScripts/views/VideoMarkNotePopup.vue` | 备注框组件（可拖动、可输入、可保存） |
| `src/contentScripts/views/ScreenshotPreview.vue` | 截图预览全屏 overlay 组件 |
| `src/contentScripts/uiManager.ts` | UI 管理器（挂载/卸载 overlay） |

### 修改文件

| 文件 | 变更内容 |
|------|----------|
| `src/logic/settings.ts` | 添加 `notePopupStrategy` 配置项 |
| `src/contentScripts/videoMarker.ts` | `saveVideoMark()` 成功后触发弹框逻辑 |
| `src/contentScripts/index.ts` | 注册新消息处理器（show-screenshot-preview） |
| `src/sidepanel/components/MarkItem.vue` | 截图点击改为发送消息，移除旧的 previewImage overlay |

---

## Task 1: 添加弹框策略配置

**Files:**
- Modify: `src/logic/settings.ts`

- [ ] **Step 1: 在 defaultSettings 中添加 notePopupStrategy 配置**

修改 `src/logic/settings.ts`，在 `defaultSettings` 对象中添加：

```typescript
export const defaultSettings = {
  // ... existing settings ...
  
  // --- 视频标记设置 ---
  videoMarkColor: '#3B82F6',
  screenshotStrategy: 'live-only' as 'live-only' | 'always' | 'never',
  screenshotWidth: 320,
  screenshotHeight: 180,
  screenshotQuality: 0.5,
  
  // 新增：备注框弹窗策略
  notePopupStrategy: 'always' as 'always' | 'never' | 'skip-fullscreen',
}
```

- [ ] **Step 2: 验证 TypeScript 类型正确**

运行: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/logic/settings.ts
git commit -m "feat(settings): add notePopupStrategy config option"
```

---

## Task 2: 创建备注框组件 VideoMarkNotePopup.vue

**Files:**
- Create: `src/contentScripts/views/VideoMarkNotePopup.vue`

- [ ] **Step 1: 创建 VideoMarkNotePopup.vue 基础结构**

```vue
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

const emit = defineEmits<{
  (e: 'save', note: string): void
  (e: 'cancel'): void
}>()

const props = defineProps<{
  timestamp: string
}>()

const visible = ref(false)
const noteValue = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// 拖动状态
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const position = ref({ x: 0, y: 0 })

// 弹框尺寸
const POPUP_WIDTH = 320
const POPUP_HEIGHT = 280
const BOTTOM_OFFSET = 120 // 距离底部 120px

function calculateDefaultPosition() {
  const x = (window.innerWidth - POPUP_WIDTH) / 2
  const y = window.innerHeight - POPUP_HEIGHT - BOTTOM_OFFSET
  return { x, y }
}

function show() {
  const defaultPos = calculateDefaultPosition()
  position.value = defaultPos
  noteValue.value = ''
  visible.value = true
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function hide() {
  visible.value = false
}

function onSave() {
  emit('save', noteValue.value)
  hide()
}

function onCancel() {
  emit('cancel')
  hide()
}

// 拖动处理
function onDragStart(e: MouseEvent) {
  isDragging.value = true
  dragOffset.value = {
    x: e.clientX - position.value.x,
    y: e.clientY - position.value.y,
  }
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e: MouseEvent) {
  if (!isDragging.value) return
  
  let newX = e.clientX - dragOffset.value.x
  let newY = e.clientY - dragOffset.value.y
  
  // 边界检查
  newX = Math.max(0, Math.min(newX, window.innerWidth - POPUP_WIDTH))
  newY = Math.max(0, Math.min(newY, window.innerHeight - POPUP_HEIGHT))
  
  position.value = { x: newX, y: newY }
}

function onDragEnd() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}

// 键盘快捷键
function handleKeydown(e: KeyboardEvent) {
  if (!visible.value) return
  
  if (e.key === 'Escape') {
    e.preventDefault()
    onCancel()
    return
  }
  
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    onSave()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown, true)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown, true)
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
})

defineExpose({ show, hide })
</script>

<template>
  <div
    v-if="visible"
    class="videomark-note-popup fixed z-[99999] w-[320px] rounded-lg bg-white shadow-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800"
    :style="{ top: `${position.y}px`, left: `${position.x}px` }"
  >
    <!-- 拖动把手 -->
    <div
      class="popup-header flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700 cursor-move select-none"
      @mousedown="onDragStart"
    >
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-200">VideoMark</span>
        <span class="text-xs text-gray-400">|</span>
        <span class="text-xs text-blue-600 dark:text-blue-400 font-medium">{{ timestamp }}</span>
      </div>
      <button
        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        @click="onCancel"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>
    
    <!-- 内容区域 -->
    <div class="p-4">
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
        记录为什么标记这个时间点...
      </p>
      <textarea
        ref="textareaRef"
        v-model="noteValue"
        class="w-full h-24 px-3 py-2 text-sm border border-gray-300 rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400"
        placeholder="在此输入备注..."
        @keydown.enter.ctrl.prevent="onSave"
      />
      
      <!-- 按钮区域 -->
      <div class="flex justify-end gap-2 mt-3">
        <button
          class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          @click="onCancel"
        >
          取消
        </button>
        <button
          class="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          @click="onSave"
        >
          保存备注
        </button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 验证组件编译通过**

运行: `npm run build:web`
Expected: 构建成功，无错误

- [ ] **Step 3: Commit**

```bash
git add src/contentScripts/views/VideoMarkNotePopup.vue
git commit -m "feat(content): add VideoMarkNotePopup component for note input"
```

---

## Task 3: 创建截图预览组件 ScreenshotPreview.vue

**Files:**
- Create: `src/contentScripts/views/ScreenshotPreview.vue`

- [ ] **Step 1: 创建 ScreenshotPreview.vue**

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const props = defineProps<{
  imageSrc: string
  timestamp: string
  note?: string
}>()

const visible = ref(false)

function show() {
  visible.value = true
}

function hide() {
  visible.value = false
  emit('close')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    hide()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  // 显示动画
  requestAnimationFrame(() => {
    show()
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

defineExpose({ show, hide })
</script>

<template>
  <div
    v-if="visible"
    class="screenshot-preview-overlay fixed inset-0 z-[99999] bg-black/90 flex items-center justify-center p-4"
    @click="hide"
  >
    <div class="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center" @click.stop>
      <!-- 关闭按钮 -->
      <button
        class="absolute -top-10 right-0 text-white/80 hover:text-white transition-colors"
        @click="hide"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>
      
      <!-- 图片 -->
      <img
        :src="imageSrc"
        class="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
        alt="视频截图预览"
      >
      
      <!-- 信息区域 -->
      <div class="mt-4 text-center">
        <p class="text-white font-medium text-lg">{{ timestamp }}</p>
        <p v-if="note" class="text-white/70 text-sm mt-1 max-w-md">{{ note }}</p>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 验证组件编译通过**

运行: `npm run build:web`
Expected: 构建成功，无错误

- [ ] **Step 3: Commit**

```bash
git add src/contentScripts/views/ScreenshotPreview.vue
git commit -m "feat(content): add ScreenshotPreview component for full-screen image viewing"
```

---

## Task 4: 创建 UI 管理器

**Files:**
- Create: `src/contentScripts/uiManager.ts`
- Modify: `src/contentScripts/index.ts`

- [ ] **Step 1: 创建 uiManager.ts**

```typescript
import { createApp, h } from 'vue'
import { sendMessage } from 'webext-bridge/content-script'
import VideoMarkNotePopup from './views/VideoMarkNotePopup.vue'
import ScreenshotPreview from './views/ScreenshotPreview.vue'
import type { Mark } from '~/logic/storage'

let notePopupInstance: any = null
let screenshotPreviewInstance: any = null

/**
 * 获取或创建挂载容器
 */
function getOrCreateContainer(id: string): HTMLElement {
  let container = document.getElementById(id)
  if (!container) {
    container = document.createElement('div')
    container.id = id
    document.body.appendChild(container)
  }
  return container
}

/**
 * 显示备注框
 */
export function showNotePopup(mark: Mark, onSave: (note: string) => void) {
  // 如果已存在，先销毁
  hideNotePopup()
  
  const container = getOrCreateContainer('videomark-note-popup-container')
  
  const app = createApp(VideoMarkNotePopup, {
    timestamp: mark.text,
    onSave: (note: string) => {
      onSave(note)
      hideNotePopup()
    },
    onCancel: () => {
      hideNotePopup()
    },
  })
  
  const instance = app.mount(container)
  notePopupInstance = { app, instance, container }
  
  // 显示弹框
  instance.show()
}

/**
 * 隐藏备注框
 */
export function hideNotePopup() {
  if (notePopupInstance) {
    notePopupInstance.instance.hide()
    notePopupInstance.app.unmount()
    notePopupInstance = null
  }
}

/**
 * 显示截图预览
 */
export function showScreenshotPreview(mark: Mark) {
  // 如果已存在，先销毁
  hideScreenshotPreview()
  
  if (!mark.screenshot) return
  
  const container = getOrCreateContainer('videomark-screenshot-preview-container')
  
  const app = createApp(ScreenshotPreview, {
    imageSrc: mark.screenshot,
    timestamp: mark.text,
    note: mark.note,
    onClose: () => {
      hideScreenshotPreview()
    },
  })
  
  const instance = app.mount(container)
  screenshotPreviewInstance = { app, instance, container }
}

/**
 * 隐藏截图预览
 */
export function hideScreenshotPreview() {
  if (screenshotPreviewInstance) {
    screenshotPreviewInstance.app.unmount()
    screenshotPreviewInstance = null
  }
}
```

- [ ] **Step 2: 在 index.ts 中导入和使用**

修改 `src/contentScripts/index.ts`，在文件顶部添加导入：

```typescript
import { showNotePopup, showScreenshotPreview } from './uiManager'
```

在消息处理器区域添加新的消息处理器：

```typescript
onMessage('show-screenshot-preview', ({ data }) => {
  const { mark } = data
  if (mark && mark.screenshot) {
    showScreenshotPreview(mark)
    return { success: true }
  }
  return { success: false, message: 'No screenshot available' }
})
```

- [ ] **Step 3: 验证编译通过**

运行: `npm run build`
Expected: 构建成功，无错误

- [ ] **Step 4: Commit**

```bash
git add src/contentScripts/uiManager.ts src/contentScripts/index.ts
git commit -m "feat(content): add UI manager for note popup and screenshot preview"
```

---

## Task 5: 修改 videoMarker.ts 添加弹框触发逻辑

**Files:**
- Modify: `src/contentScripts/videoMarker.ts`

- [ ] **Step 1: 导入 UI 管理器和设置**

在文件顶部添加：

```typescript
import { showNotePopup } from './uiManager'
```

- [ ] **Step 2: 修改 saveVideoMark 函数**

在 `saveVideoMark` 函数中，标记成功后添加弹框逻辑：

```typescript
export async function saveVideoMark(): Promise<{ success: boolean, message?: string, mark?: Mark }> {
  const video = findActiveVideo()
  if (!video) {
    console.warn('[VideoMarker] No active video found on page')
    return { success: false, message: '页面上未检测到视频' }
  }

  await waitForVideoMetadata(video, 3000)

  try {
    const mark = await createVideoMark(video)
    const result = await sendMessage('add-mark', mark, 'background')

    if (result && (result as any).success === false) {
      console.error('[VideoMarker] Failed to save mark:', (result as any)?.error)
      return { success: false, message: (result as any)?.error || '保存失败' }
    }

    // 显示 Toast
    showFeedbackToast(`已标记: ${mark.text}${mark.isLive ? ' (直播)' : ''}`)
    
    // 根据配置决定是否弹出备注框
    const shouldShowPopup = shouldShowNotePopup()
    if (shouldShowPopup) {
      showNotePopup(mark, async (note: string) => {
        if (note.trim()) {
          try {
            await sendMessage('update-mark-details', { 
              id: mark.id, 
              url: mark.url, 
              note 
            }, 'background')
            showFeedbackToast('备注已保存')
          } catch (error) {
            console.error('[VideoMarker] Failed to save note:', error)
          }
        }
      })
    }

    return { success: true, mark }
  }
  catch (error) {
    console.error('[VideoMarker] Error saving video mark:', error)
    return { success: false, message: (error as Error).message }
  }
}
```

- [ ] **Step 3: 添加 shouldShowNotePopup 辅助函数**

在文件中添加：

```typescript
/**
 * 根据配置判断是否应显示备注框
 */
function shouldShowNotePopup(): boolean {
  const strategy = settings.value.notePopupStrategy || 'always'
  
  switch (strategy) {
    case 'never':
      return false
    case 'skip-fullscreen':
      return !isFullscreen()
    case 'always':
    default:
      return true
  }
}

/**
 * 检查当前是否处于全屏状态
 */
function isFullscreen(): boolean {
  return document.fullscreenElement !== null
}
```

- [ ] **Step 4: 验证编译通过**

运行: `npm run build`
Expected: 构建成功，无错误

- [ ] **Step 5: Commit**

```bash
git add src/contentScripts/videoMarker.ts
git commit -m "feat(content): trigger note popup after video mark based on settings"
```

---

## Task 6: 修改 MarkItem.vue 支持网页区域截图预览

**Files:**
- Modify: `src/sidepanel/components/MarkItem.vue`

- [ ] **Step 1: 修改截图点击逻辑**

找到截图的 img 标签（约第 119-125 行），修改点击事件：

```vue
<img
  :src="mark.screenshot"
  class="h-auto max-h-24 max-w-full object-contain cursor-zoom-in"
  alt="视频截图"
  loading="lazy"
  @click.stop="handleScreenshotClick"
>
```

- [ ] **Step 2: 添加 handleScreenshotClick 方法**

在 `<script setup>` 中添加方法：

```typescript
import { sendMessage } from 'webext-bridge/options'

async function handleScreenshotClick() {
  if (!mark.screenshot) return
  
  try {
    // 发送消息给 content script 显示预览
    await sendMessage('show-screenshot-preview', { mark: toRaw(mark) }, 'background')
  } catch (error) {
    console.error('Failed to show screenshot preview:', error)
    // 降级：使用旧的预览方式
    previewImage.value = mark.screenshot
  }
}
```

需要在文件顶部添加导入：

```typescript
import { toRaw } from 'vue'
import { sendMessage } from 'webext-bridge/options'
```

- [ ] **Step 3: 保留旧的预览作为降级方案**

旧的 previewImage overlay 代码保持不变，作为降级方案。

- [ ] **Step 4: 验证编译通过**

运行: `npm run build`
Expected: 构建成功，无错误

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/components/MarkItem.vue
git commit -m "feat(sidepanel): send message to content script for screenshot preview"
```

---

## Task 7: 在 background 中转发截图预览消息

**Files:**
- Modify: `src/background/main.ts`

- [ ] **Step 1: 添加消息转发处理器**

在 background/main.ts 中添加新的消息处理器：

```typescript
onMessage('show-screenshot-preview', async ({ data }) => {
  try {
    const { mark } = data
    if (!mark || !mark.url) {
      return { success: false, message: 'Invalid mark data' }
    }
    
    // 查找对应标签页
    const allTabs = await browser.tabs.query({})
    const targetUrl = new URL(mark.url)
    const targetBase = targetUrl.origin + targetUrl.pathname
    
    const tab = allTabs.find((t) => {
      if (!t.url) return false
      try {
        const tabUrl = new URL(t.url)
        return tabUrl.origin + tabUrl.pathname === targetBase
      } catch {
        return false
      }
    })
    
    if (tab?.id) {
      await sendMessage('show-screenshot-preview', { mark }, { context: 'content-script', tabId: tab.id })
      return { success: true }
    }
    
    return { success: false, message: 'Target tab not found' }
  } catch (error) {
    console.error('Failed to forward screenshot preview:', error)
    return { success: false, message: (error as Error).message }
  }
})
```

- [ ] **Step 2: 验证编译通过**

运行: `npm run build`
Expected: 构建成功，无错误

- [ ] **Step 3: Commit**

```bash
git add src/background/main.ts
git commit -m "feat(background): forward screenshot preview message to content script"
```

---

## Task 8: 端到端测试

**Files:**
- 无需修改文件，执行测试命令

- [ ] **Step 1: 运行单元测试**

```bash
npm run test
```
Expected: 所有现有测试通过

- [ ] **Step 2: 运行类型检查**

```bash
npm run typecheck
```
Expected: 无类型错误

- [ ] **Step 3: 运行 ESLint**

```bash
npm run lint
```
Expected: 无 lint 错误

- [ ] **Step 4: 构建项目**

```bash
npm run build
```
Expected: 构建成功

- [ ] **Step 5: Commit**

```bash
git commit -m "test: verify all tests pass after feature implementation"
```

---

## Task 9: 可选 - 在 Options 页面添加配置 UI

**Files:**
- Modify: `src/options/Options.vue`（如果存在）

- [ ] **Step 1: 找到 Options.vue 文件**

检查 `src/options/` 目录下是否有 Options.vue 文件。

- [ ] **Step 2: 添加弹框策略设置**

如果 Options.vue 存在，添加下拉选择框：

```vue
<div class="setting-item">
  <label class="text-sm font-medium text-gray-700">备注框弹窗策略</label>
  <select 
    v-model="settings.notePopupStrategy"
    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
  >
    <option value="always">总是弹窗</option>
    <option value="skip-fullscreen">全屏时不弹窗</option>
    <option value="never">从不弹窗</option>
  </select>
  <p class="mt-1 text-xs text-gray-500">
    设置标记视频后是否弹出备注输入框
  </p>
</div>
```

- [ ] **Step 3: Commit（如果修改了）**

```bash
git add src/options/Options.vue
git commit -m "feat(options): add note popup strategy setting UI"
```

---

## 自我审查清单

### Spec 覆盖检查

| Spec 需求 | 对应 Task | 状态 |
|-----------|-----------|------|
| notePopupStrategy 配置 | Task 1 | ✅ |
| 弹框位置在视窗下方水平居中 | Task 2 | ✅ |
| 弹框可任意方向拖动 | Task 2 | ✅ |
| 拖动边界检查 | Task 2 | ✅ |
| 全屏检测 | Task 5 | ✅ |
| 配置策略：always/never/skip-fullscreen | Task 5 | ✅ |
| 截图预览在网页区域 | Task 3, 4, 6, 7 | ✅ |
| 预览显示时间点和备注 | Task 3 | ✅ |
| 预览支持 Escape 关闭 | Task 3 | ✅ |
| 点击遮罩关闭预览 | Task 3 | ✅ |

### Placeholder 扫描

- [x] 无 "TBD", "TODO", "implement later"
- [x] 无 "Add appropriate error handling" 等模糊描述
- [x] 所有步骤包含实际代码
- [x] 无 "Similar to Task N" 引用
- [x] 所有文件路径精确

### 类型一致性检查

- [x] `notePopupStrategy` 类型：`'always' | 'never' | 'skip-fullscreen'`
- [x] `sendMessage` 使用正确的上下文（content-script, background, options）
- [x] `toRaw` 在 sidepanel 中使用正确
- [x] 消息名称一致：`show-screenshot-preview`

---

## 执行选择

**Plan complete and saved to `docs/superpowers/plans/YYYY-MM-DD-videomark-enhancement.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
