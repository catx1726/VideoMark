/**
 * # 播放位置订阅 (Playback Position Subscription)
 *
 * 接收 background 广播的实时播放位置（content script 节流上报），
 * 供 TimelineView 渲染播放头。模块级单例，避免多组件重复注册监听。
 *
 * @module usePlaybackPosition
 */
import { ref } from 'vue'
import browser from 'webextension-polyfill'

export interface PlaybackPosition {
  url: string
  currentTime: number
  duration: number
}

const playback = ref<PlaybackPosition | null>(null)
let listening = false

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}`.replace(/\/$/, '')
  }
  catch {
    return url
  }
}

/** 当前播放位置是否与给定页面 url 匹配（精确或归一化） */
export function isPlaybackOnPage(url: string): boolean {
  const p = playback.value
  if (!p)
    return false
  return p.url === url || normalizeUrl(p.url) === normalizeUrl(url)
}

export function usePlaybackPosition() {
  if (!listening) {
    listening = true
    browser.runtime.onMessage.addListener((message: any) => {
      if (message && message.type === 'playback-position' && message.payload)
        playback.value = message.payload as PlaybackPosition
    })
  }
  return { playback }
}
