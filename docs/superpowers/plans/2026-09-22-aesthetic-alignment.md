# Plan: 母库美学风格移植（Issue #1）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将母库 MarkFlow 美学体系（amber 品牌色 / neutral 色板 / 零阴影 hairline / 引导线层级 / z-index token / 主题切换）移植到 Video-Mark

**Spec:** `docs/superpowers/specs/2026-09-22-aesthetic-alignment-design.md`（已批准，品牌色 = amber）

**Tech Stack:** Vue 3 + UnoCSS（px 体系，禁 rem 改动）+ TypeScript

**分支:** `issue-1`

---

## 全局约束

1. **Shadow DOM px 约定**：`contentScripts/views/` 内 px 任意值禁止改 rem 类
2. **不动 contentScripts 浮层**的阴影/圆角（功能性差异）；仅焦点环/主按钮色随品牌色
3. **不动语义色**：`highlightColors` 色板、存量 `mark.color`、LIVE 红、清理按钮 red/yellow、Popup orange 警告条
4. **同明度词根映射**：`blue-N` → `amber-N`、`gray-N` → `neutral-N`（含 `dark:`/`hover:` 变体，词根替换安全）
5. **主按钮对比度例外**：原 `bg-blue-600 text-white` → `bg-amber-500 text-gray-900`，hover `amber-600`；浅模式小字链接用 `amber-700`
6. 每 Sprint 结束跑 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 全绿后提交

---

## Sprint 1：色板 + 品牌色 + 清理（~14 文件，Surgical）

### Task 1.1: gray → neutral 词根替换

**Files:** `src/**/*.vue`、`src/logic/i18n.ts`、`src/styles/main.css`

- [ ] **Step 1:** 全部 `.vue` 与 `i18n.ts` 中 `gray-` → `neutral-` 词根替换（165 处）
- [ ] **Step 2:** `main.css` CSS 变量对齐母库终态：`#f3f4f6`→`#f5f5f5`、`#111827`→`#171717`、`#374151`→`#404040`、`#f9fafb`→`#fafafa`、`#1f2937`→`#262626`、scrollbar rgba 值对齐母库
- [ ] **Step 3:** grep `gray-` 验证零残留（允许保留：`gray-900` 主按钮深字为新增用途除外，随 Task 1.2 引入）

### Task 1.2: blue → amber 品牌色

**Files:** `src/options/Options.vue`、`src/popup/Popup.vue`、`src/sidepanel/Sidepanel.vue`、`src/sidepanel/components/{SidepanelHeader,MarkItem,TimelineCard,StorageManager}.vue`、`src/contentScripts/views/VideoMarkNotePopup.vue`、`src/logic/i18n.ts`

- [ ] **Step 1:** 43 处 `blue-*` class 同明度替换（含 `accent-blue-600`→`accent-amber-500`）
- [ ] **Step 2:** 主按钮例外处理：`bg-blue-600 text-white`（Options ×3、Popup ×1、Sidepanel ×3、SidepanelHeader ×1、MarkItem ×1、TimelineCard ×1、NotePopup ×1）→ `bg-amber-500 text-gray-900 hover:bg-amber-600`
- [ ] **Step 3:** 小字链接 `text-blue-600` → `text-amber-700`（浅模式 WCAG AA）；`dark:text-blue-400` → `dark:text-amber-400`
- [ ] **Step 4:** grep `blue-` 验证零残留

### Task 1.3: 硬编码 hex 收编

**Files:** `src/sidepanel/components/PageSection.vue`、`TimelineView.vue`、`TimelineCard.vue`、`src/logic/settings.ts`

- [ ] **Step 1:** `PageSection.vue:64-70` `getLevelBorderStyle` 阶梯 `#3B82F6/#60A5FA/#93C5FD/#BFDBFE` → `#F59E0B/#FBBF24/#FCD34D/#FDE68B`
- [ ] **Step 2:** `TimelineView.vue:163,166` 与 `TimelineCard.vue:64,75` 兜底 `'#3B82F6'` → `'#F59E0B'`
- [ ] **Step 3:** `settings.ts:16` `videoMarkColor: '#3B82F6'` → `'#F59E0B'`（注释同步；存量标记数据不动）

### Task 1.4: 清理

**Files:** `unocss.config.ts`、`src/styles/main.css`

- [ ] **Step 1:** 删除 `unocss.config.ts` 的 `theme.colors` 块（`brand.blue/red`、`border-color`，已核实零引用）
- [ ] **Step 2:** 删除 `main.css` 零引用 `.btn`；`.icon-btn` 的 `hover:text-teal-600` → `hover:text-amber-600`
- [ ] **Step 3:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 全绿，提交 S1

---

## Sprint 2：质感 + 层级 + z-token（~9 文件）

### Task 2.1: 去阴影（自有页面 21 处）

**Files:** `Popup.vue`(1)、`Options.vue`(3)、`Sidepanel.vue`(3)、`MarkItem.vue`(2)、`PageSection.vue`(3)、`SidepanelHeader.vue`(3)、`StorageManager.vue`(1)、`TagFolder.vue`(2)、`TimelineCard.vue`(2)、`TimelineView.vue`(1)

- [ ] **Step 1:** 移除全部 `shadow-sm/lg/xl`；菜单/模态层级依赖 实底+border+遮罩（与母库一致）
- [ ] **Step 2:** 保留不动：`ScreenshotPreview.vue`、`VideoMarkNotePopup.vue`（contentScripts 浮层）

### Task 2.2: 圆角收敛

- [ ] **Step 1:** 自有页面 `rounded-lg` → `rounded-md`（13 处）；`rounded-md` 及以下不动

### Task 2.3: 侧边栏层级减负

**Files:** `TagFolder.vue`、`PageSection.vue`

- [ ] **Step 1:** `TagFolder.vue:165` 区域容器 `border-x border-b bg-gray-50 dark:bg-gray-800 rounded-b-lg` → `ml-3 pl-3 border-l-2 border-neutral-200 dark:border-neutral-700`
- [ ] **Step 2:** `PageSection.vue:102` 页面卡片去 `shadow-sm`，保留 hairline border + `rounded-lg`→`rounded-md`

### Task 2.4: z-index token 化

**Files:** 新建 `src/logic/layers.ts`；改 `SidepanelHeader.vue`、`StorageManager.vue`、`PageSection.vue`、`TagFolder.vue`、`MarkItem.vue`、`TimelineCard.vue`、`TimelineView.vue`、`Sidepanel.vue`、`Options.vue`

- [ ] **Step 1:** 新建 `layers.ts`（移植母库注释结构，按本仓裁剪）：

```ts
export const Z_LAYERS = {
  stickyHeader: 40, // SidepanelHeader（唯一吸顶层）
  fixedBar: 50, // StorageManager 底部存储栏
  menuElevated: 60, // ⋯ 菜单打开时所在层临时提升
  modal: 70, // 模态/图片预览 overlay
} as const
```

- [ ] **Step 2:** 收编：`SidepanelHeader.vue:26` z-40→token；`StorageManager.vue:36` z-10→50；菜单 `PageSection.vue:153/241`、`TagFolder.vue:96`、`MarkItem.vue:230`、`TimelineCard.vue:111` z-20/30→60；模态/预览 `Sidepanel.vue:330/376`、`TimelineCard.vue:197`、`MarkItem.vue:201`、`Options.vue:774` z-50→70；`TimelineView.vue:154/174` z-10/20 为进度条内部层（组件局部堆叠，保留局部值并加注释说明不入 token 表）
- [ ] **Step 3:** 菜单提升策略：本仓仅一处 sticky header，菜单不被吸顶遮挡，无需母库「所在层提升」逻辑，仅统一 token
- [ ] **Step 4:** 全量验证命令 + 提交 S2

---

## Sprint 3：主题手动切换（~6 文件 + 2 新增）

### Task 3.1: theme 基础设施（TDD）

**Files:** 新建 `src/logic/theme.ts`、`src/tests/theme.spec.ts`

- [ ] **Step 1（红）:** 先写 `theme.spec.ts`：`resolveTheme('auto', true/false)`、`resolveTheme('light'/'dark', *)`、`resolveTheme(undefined, *)` 边界
- [ ] **Step 2（绿）:** 新建 `theme.ts`（移植母库）：`ThemePref` 类型、`THEME_CACHE_KEY = 'videomark-theme'`、`resolveTheme` 纯函数、共享 `isDark` computed、watch 镜像 localStorage
- [ ] **Step 3:** `settings.ts` 增加 `theme: 'auto' as 'auto' | 'light' | 'dark'`（mergeDefaults 兜底存量用户）

### Task 3.2: 防 FOUC + 三页面收敛

**Files:** `src/theme-init.ts`、`src/sidepanel/Sidepanel.vue`、`src/popup/Popup.vue`、`src/options/Options.vue`

- [ ] **Step 1:** `theme-init.ts` 扩展：优先读 `localStorage['videomark-theme']`，`'dark'` 直接加 class、`'light'` 不加、`'auto'`/缺失回退系统偏好（移植母库实现）
- [ ] **Step 2:** 三页面各自独立的 `usePreferredDark()` watchEffect 块 → 替换为共享 `isDark`（Sidepanel.vue:3,21-26 / Popup.vue:4,52 / Options.vue:3,15）
- [ ] **Step 3:** Shadow DOM 检查：`uiManager.ts` 若有暗类适配则接 `isDark`，无则记录不动

### Task 3.3: Options 主题选择 UI

**Files:** `src/options/Options.vue`

- [ ] **Step 1:** 外观分区增加三态选择（跟随系统/浅色/深色），即改即存（复用现有设置保存流）
- [ ] **Step 2:** 全量验证命令 + 深浅三态人工截图（Layer 3）+ 提交 S3

---

## 最终验收（对齐 Issue #1）

- [ ] `pnpm lint` / `pnpm typecheck` 0 errors
- [ ] `pnpm test` 全绿（含 `theme.spec.ts` 新增）；`pnpm build` exit 0
- [ ] Layer 3 截图比对：popup / sidepanel（列表+时间轴、三级展开、菜单打开）/ options 全 section / NotePopup；浅色+深色各一轮
- [ ] grep 零残留：`blue-`、`gray-`、`shadow-`（自有页面）、`#3B82F6`

## 回滚

每个 Sprint 独立 commit，`git revert` 单 Sprint 不影响其他；无数据迁移（`settings.theme` 有默认值兜底）
