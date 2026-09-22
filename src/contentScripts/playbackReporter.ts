/**
 * # 播放位置上报 (Playback Position Reporter)
 *
 * 监听页面主视频的播放进度，节流上报给 background，由 background 广播给
 * 侧边栏时间轴渲染「播放头」——让用户看到当前播放位置相对各标记的分布。
 *
 * - 仅播放中（timeupdate）与 seek/pause 时上报，空闲零开销
 * - 节流 1s；seeked/pause 立即上报并重置节流窗口
 * - SPA 换视频：定期检查 video 元素引用是否变化，重新绑定
 */
import { sendMessage } from 'webext-bridge/content-script'
import { findActiveVideo } from './videoMarker'

const REPORT_INTERVAL_MS = 1000
const RECHECK_INTERVAL_MS = 2000

let boundVideo: HTMLVideoElement | null = null
let lastReportAt = 0

function report(video: HTMLVideoElement, force = false) {
  const now = Date.now()
  if (!force && now - lastReportAt < REPORT_INTERVAL_MS)
    return
  lastReportAt = now
  sendMessage('playback-position', {
    url: window.location.href,
    currentTime: video.currentTime,
    duration: Number.isFinite(video.duration) ? video.duration : 0,
  }, 'background').catch(() => {})
}

function bind(video: HTMLVideoElement) {
  if (boundVideo === video)
    return
  if (boundVideo) {
    boundVideo.removeEventListener('timeupdate', onTimeUpdate)
    boundVideo.removeEventListener('seeked', onImmediate)
    boundVideo.removeEventListener('pause', onImmediate)
  }
  boundVideo = video
  video.addEventListener('timeupdate', onTimeUpdate)
  video.addEventListener('seeked', onImmediate)
  video.addEventListener('pause', onImmediate)
}

function onTimeUpdate() {
  if (boundVideo)
    report(boundVideo)
}

function onImmediate() {
  if (boundVideo)
    report(boundVideo, true)
}

/** 启动上报：立即尝试绑定；SPA 场景定期检查视频元素是否更换 */
export function startPlaybackReporter() {
  const check = () => {
    const video = findActiveVideo()
    if (video)
      bind(video)
  }
  check()
  window.setInterval(check, RECHECK_INTERVAL_MS)
}
