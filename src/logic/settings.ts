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
  theme: 'auto' as 'auto' | 'light' | 'dark', // 主题偏好：跟随系统/浅色/深色

  // --- 视频标记设置 ---
  videoMarkColor: '#F59E0B', // amber-500，视频标记默认颜色（品牌色）
  screenshotStrategy: 'live-only' as 'live-only' | 'always' | 'never', // 截图策略
  screenshotWidth: 320, // 截图宽度（px）
  screenshotHeight: 180, // 截图高度（px）
  screenshotQuality: 0.5, // 截图 JPEG 质量（0~1）
  notePopupStrategy: 'always' as 'always' | 'never' | 'skip-fullscreen', // 备注弹框策略
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
