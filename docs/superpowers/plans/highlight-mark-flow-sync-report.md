# Video-Mark ← Highlight-Mark-Flow 同步报告

- **母库版本**：v0.7.1
- **当前版本**：v0.1.0
- **分析日期**：2026-07-04

---

## 一、母库已解决的关键问题

### 1. GitHub Gist 同步问题修复

母库 PR #51 系列提交修复了多处同步 bug：

| 问题 | 母库修复方式 | 对应文件 |
|---|---|---|
| 空远程/新 Gist 首次启用时本地覆盖云端 | `connectSync` 先 `force pull` 再 `enabled=true` | `src/options/Options.vue` |
| 列表接口返回的 Gist 无文件内容 | 新增 `getGistById()`，拉取时先列表再读详情 | `src/logic/sync.ts` |
| 失败后继续推送导致数据覆盖 | 新增 `canPush()`：`lastSyncStatus !== 'none'` 才推 | `src/logic/sync.ts` |
| Pull 失败后立即 Push 覆盖远程 | Push 前若状态为 error，先尝试错误恢复 Pull | `src/background/main.ts` |
| MV3 下 webext-bridge 消息无响应 | 新增 `runtime.onMessage` fallback：`trigger-sync-pull` | `src/background/main.ts` |
| 启动时未拉取 | 新增 `runtime.onStartup` 触发 Pull | `src/background/main.ts` |
| 身份验证失败反复报错 | 自动禁用 `syncConfig.enabled` | `src/background/main.ts` |
| 大 Payload 超限无预警 | 8MB/10MB 预警并写入错误日志 | `src/background/main.ts` |

### 2. Sidepanel 搜索功能

母库 PR #52/#53 新增：

- `src/sidepanel/composables/searchFilter.ts`：搜索过滤逻辑
- `src/sidepanel/composables/useSidepanelData.ts`：接入 `searchQuery`、`debouncedSearchQuery`、`compactMode`、`filteredTree`
- `src/sidepanel/components/SidepanelHeader.vue`：搜索框、清除按钮、紧凑模式开关
- `src/sidepanel/Sidepanel.vue`：渲染 `filteredTree` 并增加无结果提示
- `src/sidepanel/composables/__tests__/searchFilter.spec.ts` 及 `testUtils.ts`：单元测试

### 3. 设置页固定侧边栏 + Scroll Spy

母库新增：

- `src/options/scrollSpy.ts`：滚动位置计算工具函数
- `src/options/__tests__/scrollSpy.spec.ts`：回归测试
- `src/options/Options.vue`：左侧 sticky 导航栏、点击平滑滚动、滚动自动高亮、保存按钮固定

---

## 二、建议同步项（按优先级）

### P0：同步稳定性修复（强烈建议）

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/logic/sync.ts` | 重写/合并 | 引入 `canPush`、`mergeWithRemoteFile`、`getGistById`，`getGists` 加分页 |
| `src/background/main.ts` | 合并同步引擎部分 | 使用 `canPush`、`performPullInternal`、错误恢复冷却、`runtime.onMessage` fallback、`onStartup` 拉取 |
| `src/options/Options.vue` | 合并 `connectSync`/`triggerPull` | 先 pull 再启用、fallback 机制、超时处理 |
| `src/tests/sync.spec.ts` | 追加测试 | `canPush`、`mergeWithRemoteFile` 测试 |

### P1：搜索功能

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/sidepanel/composables/searchFilter.ts` | 新增 | 搜索过滤函数 |
| `src/sidepanel/composables/useSidepanelData.ts` | 修改 | 接入搜索状态与 `filteredTree` |
| `src/sidepanel/components/SidepanelHeader.vue` | 修改 | 搜索框 + 紧凑模式 |
| `src/sidepanel/Sidepanel.vue` | 修改 | 渲染 `filteredTree` |
| `src/sidepanel/composables/__tests__/searchFilter.spec.ts` | 新增 | 测试 |
| `src/sidepanel/composables/__tests__/testUtils.ts` | 新增 | 测试工具 |

### P2：设置页导航体验

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/options/scrollSpy.ts` | 新增 | 滚动定位算法 |
| `src/options/__tests__/scrollSpy.spec.ts` | 新增 | 测试 |
| `src/options/Options.vue` | 重构布局 | 左侧 sticky 导航 + scroll spy |

### P3：CSP / Service Worker 兼容性修复

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/theme-init.ts` | 新增 | 提取主题初始化脚本 |
| `src/options/index.html` | 修改 | 内联 script → `src="../theme-init.ts"` |
| `src/popup/index.html` | 修改 | 同上 |
| `src/sidepanel/index.html` | 修改 | 同上 |
| `src/background/main.ts` | 修改 | `window.addEventListener` 加 `typeof window !== 'undefined'` 判断 |
| `src/manifest.ts` | 修改 | Firefox `sidebar_action` 增加 `default_title` 并使用字符串 `default_icon` |

### P4：Popup 侧边栏打开方式修复

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/popup/Popup.vue` | 修改 | Chrome 下直接调用 `sidePanel.open()`，不再通过 background 中转，保留用户手势 |

---

## 三、需要适配/存在冲突的部分

以下功能 Video-Mark 有自定义实现，同步时需保留 Video-Mark 行为：

| 区域 | 母库行为 | Video-Mark 当前行为 | 建议 |
|---|---|---|---|
| `contentScripts/` | 文本高亮、Rangy、恢复算法 | 视频标记、轨道、截图预览 | **不直接同步**，只同步通用修复（如 CSP theme） |
| `src/sidepanel/components/MarkItem.vue` | 文本高亮项 + 恢复失败提示 | 视频项（播放图标、时长、截图、平台） | 仅同步 `restoreFailedAt` 提示逻辑（如需要） |
| `src/sidepanel/composables/useMarkActions.ts` | 文本跳转 | 视频三级 URL 匹配跳转 | 保留视频逻辑 |
| `src/options/Options.vue` | 高亮颜色/高度/快捷键 | 视频标记设置 | 保留视频设置区块，仅新增 sticky 导航 |
| `src/manifest.ts` | 文本扩展 commands | `mark-video-timestamp` 命令 | 保留视频命令 |
| `src/logic/storage.ts` `Mark` | 文本字段 | 视频字段（timestamp、screenshot 等） | 保留视频字段，可新增 `restoreFailedAt` |
| `src/logic/settings.ts` | `highlightHeight`、`shortcutSave` 等 | 视频设置 | 保留视频设置 |

---

## 四、不建议同步的部分

- 文本高亮恢复算法相关文件：`src/contentScripts/monitor.ts`、`restorer.ts`、`state.ts`、`ui.ts` 等是母库文本标记核心，与 Video-Mark 视频标记无关。
- 文本高亮测试：`src/tests/restorer.spec.ts`、`monitor.spec.ts` 等。
- README/文档/营销素材：品牌、定位不同。
- Popup UI 文案/Logo：母库是 MarkFlow，Video-Mark 需保持自身品牌。

---

## 五、推荐执行顺序

1. **先同步 P0 同步稳定性修复**（风险最高，收益最大）
2. **再同步 P1 搜索功能**（用户明确需求）
3. **接着 P2 设置页导航**（用户体验）
4. **最后 P3/P4 兼容性修复**（构建/运行时安全）

---

## 六、需要确认的问题

1. Video-Mark 是否需要 `restoreFailedAt` 字段？母库用于提示"原位置已变化"，对视频标记意义不大，但可统一数据模型。
2. 搜索功能是否需要搜索视频标记的 `screenshot` / `platform` / `timestamp`？母库 `searchFilter.ts` 目前搜索 `text/html/note/title/url/contextTitle`，视频标记的额外字段可扩展。
3. 设置页左侧导航条目是否需要按 Video-Mark 的区块重新设计？（如去掉"高亮颜色/高度"，加入"视频标记设置"）
4. GitHub Gist 文件名是否保持 `videomark_sync.json`？母库使用 `markflow_sync.json`，二开应保持 `videomark_sync.json` 以避免与母库数据混淆。
