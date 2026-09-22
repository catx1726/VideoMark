# VideoMark 后续迭代建议 (NIT Roadmap)

本文档参考母库 MarkFlow (`vitesse-webext`) 的 `docs/NIT_ROADMAP.md` 格式，基于 2026-09-22 对 Video-Mark 仓库的全量代码盘点整理。母库已完成并同步（P0-P4，commit `e854c7b`）的条目不再重复收录；母库已验证有效但本仓库尚未落地的条目，标注来源后收录。

> **盘点基准**：HEAD = `e854c7b`（2026-07-04，sync P0-P4 from upstream），工作区干净。
> **母库参考**：`D:\code\2025\2.Web-Extension\vitesse-webext\docs\NIT_ROADMAP.md`（更新至 2026-09-10）。

---

## 0. 母库同步状态快照

| 批次 | 内容 | 状态 |
| :--- | :--- | :--- |
| P0 | Gist 同步稳定性（`canPush` / `getGistById` / 错误恢复冷却 / `onStartup` 拉取 / MV3 双通道 fallback / Payload 预警） | 已同步 |
| P1 | Sidepanel 搜索（`searchFilter.ts` + `filteredTree` + 紧凑模式） | 已同步 |
| P2 | Options 左侧 sticky 导航 + Scroll Spy | 已同步 |
| P3 | CSP / theme-init 外联脚本 / manifest Firefox 兼容 | 已同步 |
| P4 | Popup 直接调 `sidePanel.open()` 保留用户手势 | 已同步 |

母库 2026-07 之后的新特性（跳转历史回退 PR #90、Coach Tip、删除撤销、本地备份、i18n 英文、品牌色 amber 等）**均未同步**，见下文对应条目。

---

## 1. 架构与性能类 (High Value)

| 建议项目 | 来源 | 成本 | 收益 | 推荐等级 | 评估理由 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`structuredMarks` 改用 `shallowRef`** | 母库 CR #47 | 低 | 中 | ⭐⭐⭐⭐ | `useSidepanelData.ts:10` 的 `structuredMarks` 是大型嵌套 TagTree，当前用 `ref` 产生深度响应式追踪开销；`buildTagTree` 整体替换语义与 `shallowRef` 天然匹配。注意 `:55` 的 `watch(..., { deep: true })` 监听的是 `marksByUrl`，不受影响。 |
| **时间轴视图状态持久化** | 盘点 | 低 | 中 | ⭐⭐⭐ | `useUIState.ts:13` 的 `timelineViewUrls` 是内存 `Set`，侧边栏重开后视图偏好丢失。可镜像到 `storage.local`（本地偏好，不同步）。 |
| **截图存储与配额压力评估** | 盘点 | 中 | 高 | ⭐⭐⭐⭐ | `Mark.screenshot` 为 base64 JPEG（单张 15-30KB），直接内嵌 `marksByUrl` 主存储，既放大每次读写的序列化开销，也挤占 Gist 同步 10MB 上限。建议评估：截图剥离到独立 storage key 按需加载，或同步时默认剥离截图。 |

## 2. 可观测性与监控类

| 建议项目 | 来源 | 成本 | 收益 | 推荐等级 | 评估理由 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **日志记录器 (Logger) 封装** | 母库 PR #41 / 盘点 | 中 | 中 | ⭐⭐⭐ | 全仓 98 处 `console.*`（`videoMarker.ts` 单文件 20+ 处调试 log 会在每个视频页控制台刷屏）。统一 Logger 支持生产静默与级别控制，符合 `docs/standards/logging-standards.md`。 |
| **同步状态可见性** | 母库产品实测 | 低 | 中 | ⭐⭐⭐ | 同步状态仅在 Options 深处。侧边栏 Header / Popup 加状态点（绿/灰/红），失败点击跳 Options 同步分区。 |
| **截图失败统计** | 盘点 | 低 | 中 | ⭐⭐⭐ | `videoMarker.ts:349` CORS 截图失败仅 `console.warn`。复用 `errorCollector.ts` 采集失败域名，可沉淀"DRM/CORS 站点黑名单"数据。 |

## 3. UI/UX 体验类 (Medium Value)

| 建议项目 | 来源 | 成本 | 收益 | 推荐等级 | 评估理由 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **删除撤销 (Undo Toast)** | 母库产品实测 | 中 | 高 | ⭐⭐⭐⭐⭐ | 误删即永删是信任级缺陷。本仓库墓碑机制（`Mark.deletedAt`）已存在且批量删除已是"乐观落碑"模式：删除后 5s 内 Toast 提供"撤销"，超时真正生效。与下条"统一模态框"联动设计。 |
| **统一模态框替代原生 confirm/alert** | 盘点 | 中 | 中 | ⭐⭐⭐⭐ | 8 处原生弹窗：`Sidepanel.vue:90,113,195,200`、`useMarkActions.ts:58,122`、`useStorageMonitor.ts:26,44`。阻塞执行且样式不统一，复用自定义 Dialog。 |
| **本地 JSON 备份/导入** | 母库产品实测 | 低 | 高 | ⭐⭐⭐⭐⭐ | "本地优先"缺"本地可备份"：不用 GitHub 的用户卸载即丢数据。Options 增加全量导出（marks+tags+settings 带版本号，不含 Token）与导入（格式校验 + 复用 `sync.ts` merge）。母库已于 2026-09-11 完成，可直接移植。 |
| **i18n 国际化基础框架** | 母库 PR #41 | 中 | 高 | ⭐⭐⭐⭐ | 全部 UI 文案硬编码中文（`i18n.ts` 仅覆盖 Options 帮助区）。母库已完成英文版（Spec: `2026-08-20-i18n-english-design.md`），海外宣传前置门槛，可整套移植。 |
| **直播标记体验强化** | 盘点 | 低 | 中 | ⭐⭐⭐ | 直播标记禁止跳转（`useMarkActions.ts:58` 仅 alert 提示）。建议：侧边栏直播标记加 🔴 徽标与"直播"筛选；TimelineView 对 `isLive` 标记跳过进度条定位（直播无固定时长，`trackDuration` 兜底逻辑 `timestamp*1.1` 对直播无意义）。 |
| **时间轴视图增强** | 盘点 | 中 | 中 | ⭐⭐⭐ | 当前 `TimelineView.vue` 仅过滤 `type==='video'` 且按 timestamp 排序。可增强：①进度条点击空白处直接跳转视频到该时间（当前只在 5% 容差内跳最近标记）②悬停 tooltip 显示截图缩略图 ③与列表视图共享搜索过滤（当前时间轴无视 `searchQuery`）。 |
| **导出格式扩展（Obsidian/Notion/HTML）** | 母库分析 | 中 | 高 | ⭐⭐⭐⭐ | 当前仅纯 Markdown 导出（Turndown）。视频标记可导出为带 `mm:ss` 时间戳链接的 Obsidian callout 或 YouTube 章节格式（`00:00 标题` 清单），直接可用作视频章节。 |
| **品牌色统一** | 母库 2026-08-20 | 低 | 高 | ⭐⭐⭐ | UI 主色为 blue（`#3B82F6` 硬编码于 `PageSection.vue` 层级边框、`TimelineView.vue` 默认标记色等）。需先由 Driver 决策 VideoMark 品牌色（不必跟随母库 amber），再统一 token 化。 |
| **设置即改即存** | 母库产品实测 | 低-中 | 中 | ⭐⭐⭐ | 若 Options 仍是显式保存模型，改 watch + 防抖自动保存；Gist Token 等敏感项仍需显式确认。动手前先核实当前保存交互。 |

## 4. 代码质量与规范类 (Low Hanging Fruits)

| 建议项目 | 来源 | 成本 | 收益 | 推荐等级 | 评估理由 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **typecheck 改用 `vue-tsc --noEmit`** | 母库事故复盘 | 低 | 高 | ⭐⭐⭐⭐ | `package.json:40` 当前 `tsc --noEmit` 不解析 .vue SFC，SFC 内 TS 错误可穿过 typecheck/lint/build 三层到运行时才暴露（母库有实际事故）。 |
| **类型安全增强：消除 `as any`** | 盘点 | 中 | 中 | ⭐⭐⭐ | 67 处 `as any` / `: any`，热点：`storage.ts:87,94,100` Payload 的 `[key: string]: any`（抹平类型检查）、`background/main.ts` sidePanel/getBytesInUse、`Popup.vue:79`、`useMarkActions.ts`。建议为消息协议定义 Payload 接口 + 扩展 browser 类型声明。 |
| **测试文件与命名规范核查** | 母库 PR #51 | 低 | 低 | ⭐⭐ | 现有 15 个 spec 文件（tagTree/sync/search/sorting/scrollSpy + sidepanel composables），可对照 `docs/standards/test-driven-development.md` 统一 describe 命名风格。 |
| **注释与文案语言统一** | 母库 PR #45 | 低 | 低 | ⭐⭐ | 核心逻辑中文注释与英文混用，配合 i18n 条目逐步统一。 |

## 5. 工程基建类 (vs 母库差距)

| 建议项目 | 来源 | 成本 | 收益 | 推荐等级 | 评估理由 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **接入 CI（`.github/workflows`）** | 盘点 | 中 | 高 | ⭐⭐⭐⭐ | 母库有 CI（audit_check / spec_plan_sync / ai_review / check-docs-structure），本仓库无 `.github/`。按 `docs/superpowers/lifecycle.md`，PR 闭环依赖 CI 强制检查；至少先接入 lint + typecheck + test 基础流水线。 |
| **补建 `.project/ops_changelog.md`** | 盘点 | 低 | 中 | ⭐⭐⭐ | 模板要求的审计日志 SSOT，当前缺失，闭环阶段无审计锚点。 |
| **e2e 基建落地或移除 dangling 脚本** | 盘点 | 中 | 中 | ⭐⭐⭐ | `package.json:38` 有 `test:e2e`（playwright）且有依赖，但无 `playwright.config.ts` 与 `e2e/` 目录。二选一：补基建（母库有 e2e/ 可参考）或移除脚本避免误导。 |
| **CHANGELOG.md 建立** | 盘点 | 低 | 中 | ⭐⭐⭐ | 配合 `docs/standards/release-standards.md`，从下一版本开始记录。 |

## 6. 暂不执行 (Wontfix/Later)

- **恢复文本高亮能力**：母库核心（Rangy/restorer/search L1-L2.5）与 VideoMark 定位无关，不回溯移植。
- **数据压缩 (Gzip)**：导致 Gist 网页端不可读，优先走"截图剥离/数据精简"。
- **改名/品牌重塑**：沿用 VideoMark，商店 listing 关键词卡位即可。
- **自动聚类/AI 摘要**：重量级特性，手动标签已足够。

---

## 7. 当前任务跟踪 (Active Work)

| 项目 | 来源 | 状态 | 关联 |
| :--- | :--- | :--- | :--- |
| 母库 P0-P4 同步 | 同步报告 `docs/superpowers/plans/highlight-mark-flow-sync-report.md` | 已完成 | `e854c7b` |
| 侧边栏时间轴视图（按页面切换） | 既有实现 | 已完成 | `PageSection.vue` / `TimelineView.vue` |
| 删除撤销 (Undo Toast) | 本文档 §3 | 待办（P0） | 复用 `deletedAt` 墓碑 |
| 本地 JSON 备份/导入 | 本文档 §3 | 待办（P0） | 可移植母库 `2026-09-11-local-backup-design.md` |
| CI 接入 | 本文档 §5 | 待办（P0） | lifecycle 闭环前置 |
| i18n 英文 | 本文档 §3 | 待办（P1） | 移植母库 Spec |
| typecheck 换 vue-tsc | 本文档 §4 | 待办（P1） | 一行脚本改动 + 修存量错误 |
| 截图存储剥离评估 | 本文档 §1 | 待办（P1） | 需先出 Spec |

---

**创建日期**: 2026-09-22
**维护者**: OpenCode & Driver
**格式参考**: 母库 `docs/NIT_ROADMAP.md`
