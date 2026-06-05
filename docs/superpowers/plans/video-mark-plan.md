# Plan: 视频标记功能 (Video Mark)

> 关联 Spec: `docs/superpowers/specs/video-mark-spec.md`

## 任务列表

### Phase 1: 数据模型与配置
- [x] **Task 1.1** `src/logic/storage.ts` — 扩展 `Mark` 接口（`type/timestamp/duration/isLive/platform/videoSrc/screenshot`）
- [x] **Task 1.2** `src/logic/settings.ts` — 新增 `videoMarkColor` / `screenshotStrategy`
- [x] **Task 1.3** `src/logic/config.ts` — 新增 `VIDEO_MARK_COMMAND` / `VIDEO_MARK_SHORTCUT` / 截图常量
- [x] **Task 1.4** `src/manifest.ts` — 注册 `commands: mark-video-timestamp`，默认 `Alt+V`

### Phase 2: Background & Content Script
- [x] **Task 2.1** `src/background/main.ts` — `browser.commands.onCommand` 监听，向 active tab 发送消息
- [x] **Task 2.2** `src/contentScripts/videoMarker.ts` — **新增**：视频检测、直播判断、截图、格式化、保存
- [x] **Task 2.3** `src/contentScripts/index.ts` — 注册 `mark-video-timestamp` 和 `goto-video-mark` 消息处理器

### Phase 3: Sidepanel UI
- [x] **Task 3.1** `src/sidepanel/components/MarkItem.vue` — 视频标记渲染（播放图标、时间、LIVE 标签、缩略图）
- [x] **Task 3.2** `src/sidepanel/composables/useMarkActions.ts` — `gotoVideoMark()` 跳转逻辑
- [x] **Task 3.3** `src/logic/tagTree.ts` — 无需修改（`domIndex = timestamp * 1000` 自动按时间排序）

### Phase 4: Options 设置
- [x] **Task 4.1** `src/options/Options.vue` — 视频标记颜色、截图策略、快捷键说明

### Phase 5: 清理与品牌替换
- [x] **Task 5.1** 删除 MarkFlow 遗留（docs 站、GIF、CI 脚本、CHANGELOG 等）
- [x] **Task 5.2** 替换代码中的 `MarkFlow` / `WebMarker` 品牌引用为 `VideoMark`
- [x] **Task 5.3** 更新 `package.json` / `README.md`

### Phase 6: 验证
- [ ] **Task 6.1** `npm run build` 构建通过
- [ ] **Task 6.2** 手动验证：YouTube 视频标记、跳转、Sidepanel 展示
- [ ] **Task 6.3** 合规检查：无敏感信息、CORS 降级、输入校验

## 风险评估

| 风险 | 缓解 |
|------|------|
| CORS 截图失败 | try-catch 降级为不截图 |
| 多 video 元素选错 | 按尺寸+播放状态+可视区域排序 |
| 直播平台 DOM 变更 | 保守降级：`duration === Infinity` |

## 修改文件清单

| 文件 | 变更 |
|------|------|
| `src/logic/storage.ts` | Mark 接口扩展 |
| `src/logic/settings.ts` | 新增视频标记设置 |
| `src/logic/config.ts` | 新增视频标记常量 |
| `src/manifest.ts` | 注册 commands |
| `src/background/main.ts` | 命令监听 |
| `src/contentScripts/videoMarker.ts` | **新增** |
| `src/contentScripts/index.ts` | 消息监听集成 |
| `src/sidepanel/components/MarkItem.vue` | 视频标记展示 |
| `src/sidepanel/composables/useMarkActions.ts` | 视频跳转 |
| `src/options/Options.vue` | 设置 UI |
