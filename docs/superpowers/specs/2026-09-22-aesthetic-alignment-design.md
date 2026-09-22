# Spec: 母库美学风格移植（质感对齐 + 品牌色统一）

**日期**: 2026-09-22
**状态**: 已批准（2026-09-22 Driver 确认：品牌色选 A 跟随母库 amber；按 S1-S3 分期执行）
**来源需求**: Driver 指令「把母库的美学风格移植过来」；`docs/NIT_ROADMAP.md` §3 品牌色统一条目
**母库参考**:
- `2026-08-20-brand-color-unification-design.md`（blue → amber，同明度词根替换法）
- `2026-08-20-ui-polish-sprint-design.md`（层级减负 / 微交互 / Shadow DOM px 约定）
- `2026-09-04-sidepanel-z-index-design.md`（z token 化）
- `2026-09-07-owned-ui-texture-alignment-design.md`（gray → neutral / 去阴影 / 圆角收敛）
- 主题切换 PR #71（`theme.ts` + `theme-init.ts` 防 FOUC）
**生命周期**: 标准生命周期（跨 ~18 文件，按 §5 拆 3 个 Sprint 执行）

---

## 1. 背景与问题

母库（MarkFlow）经 5 个 Sprint 沉淀出一套完整美学体系：**amber 品牌色 + neutral 中性色板 + 零阴影 hairline + 缩进引导线层级 + z-index token + 手动主题切换**。Video-Mark 分叉于该体系建立之前，当前状态盘点（2026-09-22 全仓扫描）：

| 维度 | 母库终态 | Video-Mark 现状 | 差距 |
| :--- | :--- | :--- | :--- |
| 品牌色 | amber 系统一 | blue 系 **43 处 / 12 文件** + 硬编码 hex **17 处** | 未统一 |
| 中性色板 | neutral 系 | gray 系 **165 处** | 未迁移 |
| 阴影 | 自有页面零阴影（浮层保留） | `shadow-*` **26 处**（含自有页面卡片/菜单/模态） | 未治理 |
| 圆角 | `rounded-md` 收敛 | `rounded-lg` **13 处** | 未收敛 |
| 层级表达 | 缩进 + 引导线 | TagFolder 容器 `border-x border-b bg-gray-50` + PageSection `border shadow-sm`（盒套盒） | 未减负 |
| z-index | `src/logic/layers.ts` token | **14 处魔法数字**（z-10/z-20/z-30/z-50 散落） | 未 token 化 |
| 主题 | `settings.theme`（auto/light/dark）+ 共享 `isDark` + localStorage 防 FOUC | 3 处独立 `usePreferredDark()`（Options/Popup/Sidepanel），无手动切换，`theme-init.ts` 仅读系统偏好 | 未对齐 |
| 清理 | 死 token 已清 | `unocss.config.ts` 死 token（`brand.blue/red`、`border-color` 零引用）；`main.css` `.btn`（teal）零引用 | 未清理 |

**Shadow DOM px 约定（继承母库约束）**：`contentScripts/views/` 运行在 Shadow DOM，`px` 任意值是刻意的反 rem 污染设计，禁止改 rem 类；扩展页面（sidepanel/popup/options）为风格统一同样保留 px 写法。

## 2. 目标 / 非目标

**目标**
1. 中性色板 `gray-*` → `neutral-*` 同明度词根替换（含 `main.css` CSS 变量色值）
2. 品牌色统一（色相依 §3 决策），硬编码 hex 收编为语义化表达
3. 自有页面（popup/sidepanel/options）去阴影、`rounded-lg` → `rounded-md`
4. 侧边栏层级减负：TagFolder 中间层去边框改引导线、PageSection 去 `shadow-sm`
5. 新建 `src/logic/layers.ts`，侧边栏 z-index token 化
6. 主题手动切换：`settings.theme` + `src/logic/theme.ts` 共享 `isDark` + `theme-init.ts` 防 FOUC 扩展
7. 清理：`unocss.config.ts` 死 token、`main.css` 零引用 `.btn`

**非目标（YAGNI）**
- ❌ 不动 `contentScripts/views/` 浮层的阴影与圆角——浮层在任意第三方页面背景上需要阴影实底保证可读性（母库已确认的功能性差异）；仅焦点环/主按钮色随品牌色
- ❌ 不动用户内容色：`highlightColors` 色板、存量标记的 `mark.color`、LIVE 红、清理按钮 red/yellow 语义色、Popup orange 警告条
- ❌ 不做折叠动画 FoldPanel 移植（母库 v2 方案，独立立项，见 §5 Sprint 4）
- ❌ 不改信息架构、组件结构、交互逻辑、props/事件
- ❌ 不做 i18n、不做 `prefers-reduced-motion`（另行立项）

## 3. 决策点：品牌色（已决策：A. amber，2026-09-22 Driver）

母库选 amber 的论据是「荧光笔隐喻」。VideoMark 的产品隐喻是视频时间轴/播放，**不必然跟随 amber**。选项：

| 选项 | 主色 | 论据 |
| :--- | :--- | :--- |
| **A. 跟随母库 amber ✅ 已选** | amber-500/600，主按钮 amber-500 + gray-900 深字 | 与母库视觉资产复用度最高；暖色在视频暗色场景对比好 |
| **B. 保留 blue，仅 token 化** | blue-500/600 现状收敛 | 零品牌迁移成本；但与母库「美学移植」目标只完成一半 |
| **C. 红色系（播放键隐喻）** | red-500/600 | ▶ 播放键联想最强；但红色在 UI 中普遍是危险/删除语义色，冲突风险高 |

> 无论选哪项，替换方法一致：同明度词根映射 + 主按钮对比度例外（参照母库 §3 映射表）。
> `settings.videoMarkColor`（新建标记默认色，当前 `#3B82F6`）语义上是内容色但与品牌同源——建议随品牌色改默认值，**存量标记数据不动**。

## 4. 实施方案（按模块）

### A. 中性色板 gray → neutral
- 范围：`src/**/*.vue` + `main.css` CSS 变量（`#f3f4f6`→`#f5f5f5`、`#111827`→`#171717`、`#374151`→`#404040` 等，对照母库 `main.css` 终态）
- 方法：同明度词根替换（含 `dark:`/`hover:` 变体前缀安全），替换后 grep 验证零残留
- 例外：i18n.ts 内联 HTML 的 gray 同样替换

### B. 品牌色统一（色相依 §3）
- 43 处 `blue-*` class（Options 16 / i18n 5 / Popup 2 / NotePopup 2 / Sidepanel 4 / TimelineCard 3 / StorageManager 1 / SidepanelHeader 6 / MarkItem 4）
- 17 处硬编码 hex 收编：`PageSection.vue` 层级边框 4 色阶梯（`#3B82F6/#60A5FA/#93C5FD/#BFDBFE` → 品牌色阶梯）、`TimelineView.vue`/`TimelineCard.vue` 兜底色、`settings.videoMarkColor` 默认值
- `accent-blue-600`（Options 滑块）→ 品牌色

### C. 去阴影 + 圆角收敛
- 自有页面：`shadow-sm/lg/xl` 移除（按钮/卡片/菜单/模态/存储卡），层级改由 实底 + border + 遮罩 表达
- `rounded-lg` → `rounded-md`（13 处卡片/容器）
- 保留：TimelineCard 截图放大预览 overlay、ScreenshotPreview（contentScripts 浮层属性）

### D. 侧边栏层级减负
| 位置 | 当前 | 目标 |
| :--- | :--- | :--- |
| `TagFolder.vue` 文件夹内容容器 | `border-x border-b bg-gray-50 rounded-b-lg` | `ml-3 pl-3 border-l-2 border-neutral-200 dark:border-neutral-700` 引导线 |
| `PageSection.vue` 页面卡片 | `border shadow-sm` | 去 `shadow-sm`，保留 hairline border |

### E. z-index token 化（新建 `src/logic/layers.ts`）
- 移植母库 token 表并按本仓实际裁剪：本仓仅 SidepanelHeader 一处 sticky（母库三级吸顶体系不存在），token 表简化为 `stickyHeader: 40 / fixedBar: 50 / menuElevated: 60 / modal: 70`
- 收编 14 处：`SidepanelHeader.vue` z-40、`StorageManager.vue` z-10→50、4 处 ⋯ 菜单 z-20/z-30、模态 z-50→70、`TimelineCard` 预览 overlay z-50→70

### F. 主题手动切换
- `settings.ts` 增加 `theme: 'auto' | 'light' | 'dark'`（默认 auto，存量用户无感）
- 新建 `src/logic/theme.ts`：`resolveTheme` 纯函数（可单测）+ 共享 `isDark` + localStorage 镜像（`videomark-theme`）
- `theme-init.ts` 扩展为读 localStorage 镜像 → 系统偏好兜底
- 收敛 3 处独立 `usePreferredDark()`（Options/Popup/Sidepanel）为共享 `isDark`；Options 增加主题选择 UI（跟随系统/浅色/深色）
- contentScripts Shadow DOM 主题跟随：`uiManager.ts` 接入共享 `isDark`（若有暗色适配需求，否则本期不动）

### G. 清理
- `unocss.config.ts`：删除零引用 `brand.blue/red`、`border-color` token（已核实全仓零引用）
- `main.css`：删除零引用 `.btn`（teal 残留）；`.icon-btn` 被 `Logo.vue` 引用 → teal 改品牌色
- `Logo.vue`/`assets/logo.svg` 零引用仅记录，删除另立任务

## 5. 分期执行（对齐母库多 PR 先例）

| Sprint | 内容 | 文件量级 | 性质 |
| :--- | :--- | :--- | :--- |
| **S1** | A 中性色 + B 品牌色 + G 清理 | ~14 文件 | 机械替换为主，Surgical |
| **S2** | C 去阴影圆角 + D 层级减负 + E z-token | ~9 文件 | 质感判断，需 Layer 3 截图验收 |
| **S3** | F 主题切换 | ~6 文件 + 新增 theme.ts | 有逻辑新增（resolveTheme 单测），标准流程 |
| S4（另立 Spec） | FoldPanel 折叠动画移植 | ~5 文件 | 母库 v2 方案，独立评估 |

## 6. 风险与验证

**风险**
- 词根替换误伤语义色：blue 在本仓**全部**为品牌用途（已逐处核查 43 处清单），gray→neutral 无语义冲突；red/yellow/orange 语义色明确排除
- 引导线缩进在「标签→页→时间轴卡片」下累计挤压宽度 → 验收重点看三级展开态与时间轴视图
- 去阴影后下拉菜单/模态在浅色相似背景上边界弱化 → 依赖 border + 遮罩，Layer 3 截图确认
- 主题切换：存量用户 `settings` 无 `theme` 字段 → `mergeDefaults` 兜底 auto；`theme-init.ts` 需三页面 HTML 均引用（已确认现状均引用）

**验证（三层证据）**
- Layer 1：`pnpm lint` + `pnpm typecheck` 0 errors
- Layer 2：`pnpm test` 全通过（`resolveTheme` 新增单测：auto/light/dark × 系统明暗）；`pnpm build` exit 0
- Layer 3：`pnpm dev` 加载扩展人工截图比对——popup / sidepanel（列表+时间轴双视图、三级展开、菜单打开态）/ options 全 section / 视频页 NotePopup；浅色+深色各一轮

## 7. 回滚

`git revert` 对应 Sprint commit（纯样式 + 新增独立模块，无数据迁移；`settings.theme` 新增字段有默认值兜底，无需回填清理）
