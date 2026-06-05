/**
 * 通用视频标记轨道 (Floating Mark Track)
 *
 * 在视频画面底部叠加独立的标记层，不依赖各平台进度条实现。
 * 通过跟踪 <video> 元素位置来定位，跨所有 HTML5 视频网站通用。
 */

import { sendMessage } from 'webext-bridge/content-script'
import { findActiveVideo } from './videoMarker'
import { URLNormalizer, getMaxZIndex } from '~/logic/dom'

const TRACK_ID = 'videomark-track'
const TRACK_HEIGHT = 4
const ANCHOR_WIDTH = 3
const ANCHOR_HEIGHT = 10

let currentTrack: HTMLElement | null = null
let currentVideo: HTMLVideoElement | null = null
let resizeObserver: ResizeObserver | null = null
let srcObserver: MutationObserver | null = null
let domObserver: MutationObserver | null = null
let urlCheckTimer: number | null = null
let hideTimer: number | null = null
let autoHideCleanup: (() => void) | null = null
let lastKnownUrl = ''

/**
 * 初始化标记轨道
 */
export async function initMarkTrack() {
  const video = findActiveVideo()
  if (!video || !Number.isFinite(video.duration)) {
    // 视频存在但 duration 无效（未加载完）：先不销毁，等加载完再试
    if (!video) {
      destroyTrack()
    }
    return
  }

  if (currentVideo === video && currentTrack) {
    // 同一视频，刷新锚点即可（duration 可能刚加载出来）
    await renderAnchors()
    return
  }

  currentVideo = video
  createTrack()
  await renderAnchors()
  startPositionTracking(video)
  startSrcWatching(video)
  startAutoHide(video)
}

/**
 * 销毁当前轨道
 */
export function destroyTrack() {
  if (hideTimer) {
    window.clearTimeout(hideTimer)
    hideTimer = null
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (srcObserver) {
    srcObserver.disconnect()
    srcObserver = null
  }
  if (domObserver) {
    domObserver.disconnect()
    domObserver = null
  }
  if (urlCheckTimer) {
    window.clearInterval(urlCheckTimer)
    urlCheckTimer = null
  }
  if (autoHideCleanup) {
    autoHideCleanup()
    autoHideCleanup = null
  }
  if (currentTrack) {
    currentTrack.remove()
    currentTrack = null
  }
  currentVideo = null
}

/**
 * 刷新标记（重新获取数据并渲染）
 */
export async function refreshMarkTrack() {
  if (!currentTrack || !currentVideo) {
    await initMarkTrack()
    return
  }
  // 清空现有锚点
  currentTrack.querySelectorAll('.videomark-anchor').forEach(el => el.remove())
  await renderAnchors()
}

/**
 * 创建轨道容器
 */
function createTrack() {
  const savedVideo = currentVideo
  destroyTrack()
  currentVideo = savedVideo

  const zIndex = getMaxZIndex() + 10

  const track = document.createElement('div')
  track.id = TRACK_ID
  track.style.cssText = `
    position: fixed;
    height: ${TRACK_HEIGHT}px;
    z-index: ${zIndex};
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.25s ease;
    background: rgba(0, 0, 0, 0.35);
    border-top: 1px solid rgba(255, 255, 255, 0.45);
    border-bottom: 1px solid rgba(0, 0, 0, 0.5);
    box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.3);
  `

  document.body.appendChild(track)
  currentTrack = track
}

/**
 * 渲染标记锚点
 */
async function renderAnchors() {
  if (!currentTrack || !currentVideo) {
    return
  }

  const duration = getVideoDuration(currentVideo)
  if (!duration) {
    return
  }

  try {
    const marks = await fetchMarksForCurrentUrl()

    for (const mark of marks) {
      if (mark.type !== 'video' || mark.timestamp === undefined)
        continue
      if (mark.deletedAt)
        continue

      // 标记可能没存 duration（旧数据或异常），用当前视频 duration 兜底
      const markDuration = mark.duration || duration
      const percent = (mark.timestamp / markDuration) * 100
      if (percent < 0 || percent > 100)
        continue

      const anchor = createAnchorElement(mark, percent)
      currentTrack.appendChild(anchor)
    }
  }
  catch (e) {
    console.error('[MarkTrack] Failed to render anchors:', e)
  }
}

/**
 * 创建单个锚点元素
 */
function createAnchorElement(mark: any, percent: number): HTMLElement {
  const el = document.createElement('div')
  el.className = 'videomark-anchor'
  el.style.cssText = `
    position: absolute;
    left: ${percent}%;
    bottom: 0;
    width: ${ANCHOR_WIDTH}px;
    height: ${ANCHOR_HEIGHT}px;
    background-color: ${mark.color || '#3B82F6'};
    border-radius: 1px;
    transform: translateX(-50%);
    pointer-events: auto;
    cursor: pointer;
    transition: transform 0.15s ease, height 0.15s ease;
    box-shadow: 0 0 3px rgba(0,0,0,0.4);
  `

  // 悬停放大
  el.addEventListener('mouseenter', () => {
    el.style.transform = 'translateX(-50%) scaleY(1.4)'
    el.style.zIndex = '10'
    showTooltip(el, mark)
  })
  el.addEventListener('mouseleave', () => {
    el.style.transform = 'translateX(-50%) scaleY(1)'
    el.style.zIndex = ''
    hideTooltip()
  })

  // 点击跳转
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (currentVideo && mark.timestamp !== undefined) {
      currentVideo.currentTime = mark.timestamp
      currentVideo.play().catch(() => {})
    }
  })

  return el
}

/**
 * 启动自动隐藏/显示：默认隐藏，鼠标进入视频/轨道区域时显示
 */
function startAutoHide(video: HTMLVideoElement) {
  if (autoHideCleanup) {
    autoHideCleanup()
    autoHideCleanup = null
  }

  let delayTimer: number | null = null

  const show = () => {
    if (delayTimer) {
      window.clearTimeout(delayTimer)
      delayTimer = null
    }
    if (currentTrack)
      currentTrack.style.opacity = '0.7'
  }

  const scheduleHide = () => {
    delayTimer = window.setTimeout(() => {
      if (currentTrack)
        currentTrack.style.opacity = '0'
    }, 2000)
  }

  // 监听 video 元素
  video.addEventListener('mouseenter', show)
  video.addEventListener('mouseleave', scheduleHide)

  // 监听轨道（防止鼠标从 video 滑入轨道时触发隐藏）
  const onTrackEnter = () => show()
  const onTrackLeave = () => scheduleHide()
  currentTrack?.addEventListener('mouseenter', onTrackEnter)
  currentTrack?.addEventListener('mouseleave', onTrackLeave)

  // 首次发现视频且有标记时，短暂显示 3 秒提示用户
  if (currentTrack && currentTrack.querySelectorAll('.videomark-anchor').length > 0) {
    currentTrack.style.opacity = '0.7'
    delayTimer = window.setTimeout(() => {
      if (currentTrack)
        currentTrack.style.opacity = '0'
    }, 3000)
  }

  autoHideCleanup = () => {
    video.removeEventListener('mouseenter', show)
    video.removeEventListener('mouseleave', scheduleHide)
    currentTrack?.removeEventListener('mouseenter', onTrackEnter)
    currentTrack?.removeEventListener('mouseleave', onTrackLeave)
    if (delayTimer)
      window.clearTimeout(delayTimer)
  }
}

/**
 * 显示 tooltip（含截图预览）
 */
function showTooltip(anchor: HTMLElement, mark: any) {
  hideTooltip()

  const tooltip = document.createElement('div')
  tooltip.id = 'videomark-anchor-tooltip'

  const timeText = mark.text || formatSeconds(mark.timestamp)
  const noteText = mark.note
    ? `<div style="margin-top:6px;font-size:12px;opacity:0.9;max-width:180px;word-break:break-word;line-height:1.5;">${escapeHtml(mark.note)}</div>`
    : ''

  const hasScreenshot = mark.screenshot && typeof mark.screenshot === 'string' && mark.screenshot.startsWith('data:')
  const screenshotHtml = hasScreenshot
    ? `<img src="${mark.screenshot}" style="width:100px;height:auto;border-radius:4px;margin-bottom:6px;display:block;object-fit:cover;box-shadow:0 1px 4px rgba(0,0,0,0.3);">`
    : ''

  tooltip.innerHTML = `
    ${screenshotHtml}
    <div style="font-weight:600;font-size:13px;white-space:nowrap;">⏱ ${timeText}</div>
    ${noteText}
  `
  tooltip.style.cssText = `
    position: fixed;
    z-index: ${getMaxZIndex() + 20};
    background: rgba(0,0,0,0.88);
    color: white;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
    line-height: 1.4;
    pointer-events: none;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    backdrop-filter: blur(8px);
    max-width: 220px;
  `

  document.body.appendChild(tooltip)

  // 定位在锚点上方
  const rect = anchor.getBoundingClientRect()
  const tooltipRect = tooltip.getBoundingClientRect()
  let left = rect.left - tooltipRect.width / 2
  let top = rect.top - tooltipRect.height - 10

  // 边界处理
  left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8))
  top = Math.max(8, top)

  tooltip.style.left = `${left}px`
  tooltip.style.top = `${top}px`
}

function hideTooltip() {
  document.getElementById('videomark-anchor-tooltip')?.remove()
}

/**
 * 跟踪视频元素位置
 */
function startPositionTracking(video: HTMLVideoElement) {
  const update = () => updateTrackPosition(video)
  update()

  resizeObserver = new ResizeObserver(update)
  resizeObserver.observe(video)

  window.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', update, { passive: true })
  document.addEventListener('fullscreenchange', update)
}

/**
 * 更新轨道位置
 */
function updateTrackPosition(video: HTMLVideoElement) {
  if (!currentTrack)
    return

  const rect = video.getBoundingClientRect()

  // 有效性检查：如果视频不在视口或尺寸异常，隐藏轨道
  if (rect.width < 50 || rect.height < 50 || rect.bottom < 0 || rect.top > window.innerHeight) {
    currentTrack.style.display = 'none'
    return
  }

  currentTrack.style.display = ''

  const isFullscreen = document.fullscreenElement !== null

  // 全屏时轨道放在视频底部（YouTube 进度条上方约 40px 处）
  const bottomOffset = isFullscreen ? 40 : 0

  currentTrack.style.left = `${rect.left}px`
  currentTrack.style.width = `${rect.width}px`
  currentTrack.style.top = `${rect.bottom - TRACK_HEIGHT - bottomOffset}px`
}

/**
 * 监听 video src 变化（YouTube 内切换视频不刷新页面）
 */
function startSrcWatching(video: HTMLVideoElement) {
  srcObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'src') {
        // 延迟一点等视频加载完成
        setTimeout(() => initMarkTrack(), 800)
        return
      }
    }
  })
  srcObserver.observe(video, { attributes: true, attributeFilter: ['src'] })
}

/**
 * 启动视频发现模式：当页面中没有视频时，监听 DOM 变化自动发现视频
 */
export function startVideoDiscovery() {
  if (domObserver)
    return

  let debounceTimer: number | null = null
  domObserver = new MutationObserver(() => {
    if (debounceTimer)
      window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => {
      // 如果当前没有活跃轨道，尝试初始化
      if (!currentTrack || !currentVideo || !document.body.contains(currentVideo)) {
        initMarkTrack().catch(() => {})
      }
    }, 500)
  })

  domObserver.observe(document.body, { childList: true, subtree: true })

  // 同时启动 URL 变化监听（SPA 导航）
  startUrlWatching()
}

/**
 * 监听 URL 变化（SPA 导航如 YouTube、Bilibili）
 */
function startUrlWatching() {
  if (urlCheckTimer)
    return

  lastKnownUrl = window.location.href
  urlCheckTimer = window.setInterval(() => {
    const currentUrl = window.location.href
    if (currentUrl !== lastKnownUrl) {
      lastKnownUrl = currentUrl
      // URL 变了，可能是 SPA 导航，延迟后重新初始化轨道
      setTimeout(() => {
        // 强制重置当前视频引用，让 initMarkTrack 重新发现
        currentVideo = null
        initMarkTrack().catch(() => {})
      }, 1000)
    }
  }, 1000) as unknown as number
}

/**
 * 从 background 获取当前页面的标记
 * 同时尝试原始 URL 和规范化 URL（去除 tracking 参数）
 */
async function fetchMarksForCurrentUrl() {
  try {
    const rawUrl = window.location.href
    const canonicalUrl = URLNormalizer.getCanonicalUrl()

    // 并行查询两种 URL
    const [rawResult, canonicalResult] = await Promise.all([
      sendMessage('get-marks-for-url', { url: rawUrl }, 'background').catch(() => []),
      rawUrl !== canonicalUrl
        ? sendMessage('get-marks-for-url', { url: canonicalUrl }, 'background').catch(() => [])
        : [],
    ])

    const rawMarks = (rawResult && Array.isArray(rawResult)) ? rawResult : []
    const canonicalMarks = (canonicalResult && Array.isArray(canonicalResult)) ? canonicalResult : []

    // 合并并去重（按 id）
    const seen = new Set<string>()
    const merged: any[] = []
    for (const mark of [...rawMarks, ...canonicalMarks]) {
      if (mark && mark.id && !seen.has(mark.id)) {
        seen.add(mark.id)
        merged.push(mark)
      }
    }
    return merged
  }
  catch (e) {
    console.error('[MarkTrack] fetchMarksForCurrentUrl error:', e)
    return []
  }
}

/**
 * 获取视频有效 duration，支持多种兜底策略
 */
function getVideoDuration(video: HTMLVideoElement): number | undefined {
  if (Number.isFinite(video.duration) && video.duration > 0)
    return video.duration

  // 兜底 1：从 seekable 范围获取
  try {
    if (video.seekable && video.seekable.length > 0) {
      const end = video.seekable.end(video.seekable.length - 1)
      if (Number.isFinite(end) && end > 0)
        return end
    }
  }
  catch {}

  // 兜底 2：从 buffered 范围获取
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

function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0)
    return '--:--'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const pad = (n: number) => n.toString().padStart(2, '0')
  if (hrs > 0)
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
  return `${pad(mins)}:${pad(secs)}`
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
