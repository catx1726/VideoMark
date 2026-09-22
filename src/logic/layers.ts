/**
 * # 侧边栏 z-index 分层 token (Sidepanel Layering Tokens)
 *
 * 集中定义侧边栏的层级体系，消除散落在各组件中的魔法数字。
 *
 * **作用域**：主要适用于 sidepanel 文档（Options 模态复用 `modal`
 * token 以保持一致）。content-script 运行在页面 Shadow DOM 内，
 * 层级独立管理，请勿在 content-script 中引用本文件。
 *
 * ## 分层表
 *
 * | token | 值 | 用途 |
 * |------|-----|------|
 * | `stickyHeader` | 40 | 侧边栏主 header（搜索/新建标签，唯一吸顶层） |
 * | `fixedBar` | 50 | 底部存储栏（须高于吸顶层） |
 * | `menuElevated` | 60 | ⋯ 下拉菜单 |
 * | `modal` | 70 | 模态对话框 / 图片预览 overlay |
 *
 * 本仓侧边栏仅一处吸顶层（SidepanelHeader），不存在母库（MarkFlow）
 * 多级吸顶导致的菜单遮挡问题，故无「菜单打开时所在层提升」逻辑。
 *
 * @module layers
 */
export const Z_LAYERS = {
  stickyHeader: 40,
  fixedBar: 50,
  menuElevated: 60,
  modal: 70,
} as const
