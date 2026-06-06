import { onMessage } from 'webext-bridge/content-script'
import { collectError } from '../logic/errorCollector'
import { gotoVideoTimestamp, saveVideoMark } from './videoMarker'
import { initMarkTrack, refreshMarkTrack, startVideoDiscovery } from './markTrack'
import { showScreenshotPreview } from './uiManager'
import { isPageBlacklisted, settings, settingsReady } from '~/logic/settings'
import '../styles'

window.addEventListener('error', event => collectError(event.error, 'content'))
window.addEventListener('unhandledrejection', event => collectError(event.reason, 'content'))

/* eslint-disable no-console */
console.log('[VideoMark] CONTENT SCRIPT LOADED AT TOP LEVEL')

// ── Simple initialization ──
async function initialize() {
  console.log('[ContentScript] Initializing VideoMark...')
  try {
    await settingsReady
    console.log('[ContentScript] Settings ready.')
    if (isPageBlacklisted(window.location.href, settings.value.blacklist)) {
      console.log('[ContentScript] Page is blacklisted, skipping.')
      return
    }
    // 启动标记轨道
    await initMarkTrack()
    // 如果初始化时没找到视频（SPA 场景），启动发现模式持续监听
    startVideoDiscovery()
    console.log('[ContentScript] Initialization complete.')
  }
  catch (e) {
    console.error('[ContentScript] Initialization failed:', e)
  }
}

initialize()

// ── Video Mark Message Handlers ──
onMessage('mark-video-timestamp', async () => {
  console.log('[ContentScript] Received mark-video-timestamp command')
  await settingsReady
  if (isPageBlacklisted(window.location.href, settings.value.blacklist)) {
    console.log('[ContentScript] Page is blacklisted, skipping video mark.')
    return { success: false, message: '当前页面在黑名单中' }
  }
  const result = await saveVideoMark()
  if (result.success) {
    // 标记成功后刷新轨道
    await refreshMarkTrack().catch(() => {})
  }
  return result
})

onMessage('goto-video-mark', ({ data }) => {
  const { timestamp, isLive } = data
  if (isLive) {
    console.log('[ContentScript] Live stream mark cannot jump to timestamp')
    return { success: false, message: '直播内容无法跳转回历史时间点' }
  }
  const success = gotoVideoTimestamp(timestamp)
  return { success, message: success ? undefined : '未找到视频元素或跳转失败' }
})

onMessage('refresh-mark-track', async () => {
  console.log('[ContentScript] Received refresh-mark-track')
  await refreshMarkTrack().catch(() => {})
  return { success: true }
})

onMessage('show-screenshot-preview', ({ data }) => {
  console.log('[ContentScript] Received show-screenshot-preview')
  showScreenshotPreview(data.mark)
  return { success: true }
})
