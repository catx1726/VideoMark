import { sendMessage } from 'webext-bridge/content-script'
import { settings } from '~/logic/settings'
import { querySelectorAllDeep } from '~/logic/dom'
import type { Mark } from '~/logic/storage'

export interface VideoInfo {
  currentTime: number
  duration: number
  src: string
  isLive: boolean
  platform: string
}

/**
 * 查找页面中最可能的主视频元素
 * 策略：可见的、尺寸最大的、正在播放的 video 元素优先
 */
export function findActiveVideo(): HTMLVideoElement | null {
  const allVideos = querySelectorAllDeep('video') as NodeListOf<HTMLVideoElement>
  const candidates: HTMLVideoElement[] = []

  for (const video of Array.from(allVideos)) {
    const rect = video.getBoundingClientRect()
    const style = window.getComputedStyle(video)

    // 过滤不可见的
    if (rect.width < 100 || rect.height < 100)
      continue
    if (style.display === 'none' || style.visibility === 'hidden')
      continue

    candidates.push(video)
  }

  if (candidates.length === 0)
    return null
  if (candidates.length === 1)
    return candidates[0]

  // 多视频时按优先级排序
  candidates.sort((a, b) => {
    const aRect = a.getBoundingClientRect()
    const bRect = b.getBoundingClientRect()
    const aArea = aRect.width * aRect.height
    const bArea = bRect.width * bRect.height

    // 正在播放的优先
    if (!a.paused && b.paused)
      return -1
    if (a.paused && !b.paused)
      return 1

    // 更大的优先
    if (aArea !== bArea)
      return bArea - aArea

    // currentTime > 0 的优先（说明用户已经开始看了）
    if (a.currentTime > 0 && b.currentTime === 0)
      return -1
    if (a.currentTime === 0 && b.currentTime > 0)
      return 1

    return 0
  })

  return candidates[0]
}

/**
 * 检测当前视频平台
 */
export function detectPlatform(): string {
  const hostname = location.hostname
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be'))
    return 'youtube'
  if (hostname.includes('bilibili.com'))
    return 'bilibili'
  if (hostname.includes('twitch.tv'))
    return 'twitch'
  if (hostname.includes('douyin.com'))
    return 'douyin'
  if (hostname.includes('ixigua.com'))
    return 'ixigua'
  if (hostname.includes('vimeo.com'))
    return 'vimeo'
  if (hostname.includes('netflix.com'))
    return 'netflix'
  if (hostname.includes('disneyplus.com'))
    return 'disneyplus'
  return 'generic'
}

/**
 * 检测当前视频是否为直播
 * 多层策略：视频属性 → URL 特征 → 平台 DOM 特征
 *
 * 核心原则：duration 是最可靠的指标。只有在明确证据下才判定为直播。
 */
export function detectLiveStream(video: HTMLVideoElement): boolean {
  // 1. 视频属性层面 —— 最可靠的指标
  if (video.duration === Infinity)
    return true // 明确的直播流

  if (Number.isFinite(video.duration) && video.duration > 0) {
    if (video.duration > 86400)
      return true // 超过24小时的 DVR 窗口
    return false // 明确的点播视频（有有效 duration）
  }

  // duration 是 NaN 或 0：视频可能还没加载 metadata，不能仅凭此判定直播
  // 继续用其他指标判断

  // 2. URL 特征层面
  const src = video.currentSrc || video.src || ''
  if (src.includes('.m3u8') && !src.includes('vod'))
    return true
  if (src.includes('.mpd') && !src.includes('vod'))
    return true

  // 3. 平台 DOM 特征层面（限制在播放器区域内，避免匹配侧边栏推荐等无关元素）
  const hostname = location.hostname
  const playerArea = document.querySelector('#movie_player, #player, .html5-video-player, .live-player, .player-wrap') || document.body

  if (hostname.includes('youtube.com')) {
    // YouTube 直播需要多个特征同时存在（避免 Premiere 等误判）
    const hasLiveBadge = !!playerArea.querySelector('.ytp-live-badge')
    const hasLiveButton = !!playerArea.querySelector('.ytp-live')
    const hasLiveDot = !!playerArea.querySelector('.ytp-live-badge ~ .ytp-live-dot, .ytp-live-dot')
    // 至少两个特征同时存在才判定为直播（提高置信度）
    const liveSignals = [hasLiveBadge, hasLiveButton, hasLiveDot].filter(Boolean).length
    if (liveSignals >= 2)
      return true
    // 如果视频已加载但 duration 仍为 0，且有一个直播特征 → 可能是直播
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA && video.duration === 0 && hasLiveBadge)
      return true
  }
  if (hostname.includes('bilibili.com')) {
    if (playerArea.querySelector('.live-player'))
      return true
    if (playerArea.querySelector('.web-player-icon-live'))
      return true
  }
  if (hostname.includes('twitch.tv')) {
    if (playerArea.querySelector('.live-indicator'))
      return true
  }
  if (hostname.includes('douyin.com')) {
    if (playerArea.querySelector('.living-icon'))
      return true
  }

  // 4. 保守默认：不确定时假设为点播（避免误伤正常视频）
  return false
}

/**
 * 使用 Canvas 截取视频当前帧，生成缩略图
 * @returns base64 JPEG data URL 或 undefined（如果失败）
 */
export function captureScreenshot(video: HTMLVideoElement): string | undefined {
  try {
    const canvas = document.createElement('canvas')
    const aspectRatio = video.videoWidth / video.videoHeight

    const maxW = settings.value.screenshotWidth || 320
    const maxH = settings.value.screenshotHeight || 180
    const quality = settings.value.screenshotQuality ?? 0.5

    let width = maxW
    let height = maxH

    if (aspectRatio > maxW / maxH) {
      height = Math.round(width / aspectRatio)
    }
    else {
      width = Math.round(height * aspectRatio)
    }

    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx)
      return undefined

    ctx.drawImage(video, 0, 0, width, height)

    // 尝试导出，如果视频受 CORS 限制会抛出 SecurityError
    return canvas.toDataURL('image/jpeg', quality)
  }
  catch (error) {
    console.warn('[VideoMarker] Screenshot failed (likely CORS):', error)
    return undefined
  }
}

/**
 * 将秒数格式化为 MM:SS 或 HH:MM:SS
 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0)
    return '--:--'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const pad = (n: number) => n.toString().padStart(2, '0')

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
  }
  return `${pad(mins)}:${pad(secs)}`
}

/**
 * 获取视频有效 duration（支持 seekable/buffered 兜底）
 */
function getVideoDuration(video: HTMLVideoElement): number | undefined {
  if (Number.isFinite(video.duration) && video.duration > 0)
    return video.duration

  try {
    if (video.seekable && video.seekable.length > 0) {
      const end = video.seekable.end(video.seekable.length - 1)
      if (Number.isFinite(end) && end > 0)
        return end
    }
  }
  catch {}

  try {
    if (video.buffered && video.buffered.length > 0) {
      const end = video.buffered.end(video.buffered.length - 1)
      if (Number.isFinite(end) && end > 0)
        return end
    }
  }
  catch {}

  return undefined
}

/**
 * 获取视频信息
 */
export function getVideoInfo(video: HTMLVideoElement): VideoInfo {
  return {
    currentTime: video.currentTime,
    duration: getVideoDuration(video),
    src: video.currentSrc || video.src || '',
    isLive: detectLiveStream(video),
    platform: detectPlatform(),
  }
}

/**
 * 创建视频标记数据对象
 */
export async function createVideoMark(video: HTMLVideoElement): Promise<Mark> {
  const info = getVideoInfo(video)
  const platform = detectPlatform()
  const isLive = info.isLive

  // 决定是否需要截图
  const shouldScreenshot = isLive
    ? true
    : settings.value.screenshotStrategy === 'always'

  let screenshot: string | undefined
  if (shouldScreenshot && settings.value.screenshotStrategy !== 'never') {
    screenshot = captureScreenshot(video)
  }

  const uniqueId = `vm-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  const formattedTime = formatTime(info.currentTime)

  return {
    id: uniqueId,
    url: window.location.href,
    text: formattedTime,
    note: '',
    color: settings.value.videoMarkColor || '#3B82F6',
    createdAt: Date.now(),
    title: document.title,
    domIndex: Math.round(info.currentTime * 1000), // 用于按时间排序
    tags: ['inbox'],
    contextTitle: '🎬 视频标记',
    contextLevel: 7,
    contextSelector: 'body',
    contextOrder: -1,
    surroundingSnippet: `视频标记 @ ${formattedTime}`,

    type: 'video',
    timestamp: info.currentTime,
    duration: info.duration,
    isLive,
    platform,
    videoSrc: info.src,
    screenshot,
  }
}

/**
 * 等待视频加载 metadata 且 duration 有效（带超时）
 */
function waitForVideoMetadata(video: HTMLVideoElement, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve) => {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA
      && Number.isFinite(video.duration)
      && video.duration > 0) {
      resolve()
      return
    }

    let timer: ReturnType<typeof setTimeout>

    function cleanup() {
      clearTimeout(timer)
      video.removeEventListener('loadedmetadata', onReady)
      video.removeEventListener('durationchange', onReady)
      video.removeEventListener('error', onError)
    }

    function onReady() {
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA
        && Number.isFinite(video.duration)
        && video.duration > 0) {
        cleanup()
        resolve()
      }
    }

    function onError() {
      cleanup()
      resolve()
    }

    timer = setTimeout(() => {
      cleanup()
      resolve()
    }, timeoutMs)

    video.addEventListener('loadedmetadata', onReady)
    video.addEventListener('durationchange', onReady)
    video.addEventListener('error', onError)
  })
}

/**
 * 保存视频标记
 * 查找主视频 → 等待加载 → 创建标记 → 发送给 background
 */
export async function saveVideoMark(): Promise<{ success: boolean, message?: string }> {
  const video = findActiveVideo()
  if (!video) {
    console.warn('[VideoMarker] No active video found on page')
    return { success: false, message: '页面上未检测到视频' }
  }

  // 如果视频还没加载完，等一下（避免 NaN duration 导致误判直播）
  await waitForVideoMetadata(video, 3000)

  try {
    const mark = await createVideoMark(video)
    const result = await sendMessage('add-mark', mark, 'background')

    if (result && (result as any).success === false) {
      console.error('[VideoMarker] Failed to save mark:', (result as any)?.error)
      return { success: false, message: (result as any)?.error || '保存失败' }
    }

    // 显示一个短暂的视觉反馈（可选：Toast 或页面内提示）
    showFeedbackToast(`已标记: ${mark.text}${mark.isLive ? ' (直播)' : ''}`)

    return { success: true }
  }
  catch (error) {
    console.error('[VideoMarker] Error saving video mark:', error)
    return { success: false, message: (error as Error).message }
  }
}

/**
 * 跳转到视频标记的时间点
 */
export function gotoVideoTimestamp(timestamp: number): boolean {
  const video = findActiveVideo()
  if (!video) {
    console.warn('[VideoMarker] No video found for goto')
    return false
  }

  try {
    video.currentTime = timestamp
    video.play().catch(() => {})
    return true
  }
  catch (error) {
    console.error('[VideoMarker] Failed to set video time:', error)
    return false
  }
}

/**
 * 页面内短暂显示反馈提示
 */
function showFeedbackToast(message: string) {
  const toast = document.createElement('div')
  toast.textContent = message
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 999999;
    pointer-events: none;
    transition: opacity 0.3s ease;
  `
  document.body.appendChild(toast)

  requestAnimationFrame(() => {
    setTimeout(() => {
      toast.style.opacity = '0'
      setTimeout(() => toast.remove(), 300)
    }, 1500)
  })
}
