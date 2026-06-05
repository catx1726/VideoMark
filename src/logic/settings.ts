import { useWebExtensionStorage } from '~/composables/useWebExtensionStorage'

export const defaultSettings = {
  defaultHighlightColor: '#FFFF00', // yellow
  highlightColors: [
    '#FFFF00', // yellow
    '#99FF99', // green
    '#FF9999', // red
    '#99CCFF', // blue
    '#FFCC99', // orange
  ],
  blacklist: [] as string[],
  autoAssociation: true,

  // --- 视频标记设置 ---
  videoMarkColor: '#3B82F6', // blue-500，视频标记默认颜色
  screenshotStrategy: 'live-only' as 'live-only' | 'always' | 'never', // 截图策略
  screenshotWidth: 320, // 截图宽度（px）
  screenshotHeight: 180, // 截图高度（px）
  screenshotQuality: 0.5, // 截图 JPEG 质量（0~1）
}

export function isPageBlacklisted(url: string, blacklist: string[]): boolean {
  try {
    const hostname = new URL(url).hostname
    return blacklist.some(pattern => hostname.endsWith(pattern))
  }
  catch {
    return false
  }
}

export const { data: settings, dataReady: settingsReady } = useWebExtensionStorage('webext-settings', defaultSettings)
