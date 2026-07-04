<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch, watchEffect } from 'vue'
import { usePreferredDark } from '@vueuse/core'
import { cloneDeep } from 'lodash-es'
import browser from 'webextension-polyfill'
import { sendMessage } from 'webext-bridge/options'
import { getLogs } from '../logic/errorCollector'
import { getActiveSectionId } from './scrollSpy'
import { settings } from '~/logic/settings'
import { dataReady, marksByUrl, syncConfig, syncReady, syncStatus, tagsMetadata, tagsReady } from '~/logic/storage'
import { createGist, getGists } from '~/logic/sync'
import { t } from '~/logic/i18n'
import { VIDEO_MARK_COMMAND } from '~/logic/config'

const isDark = usePreferredDark()
watchEffect(() => {
  if (isDark.value)
    document.documentElement.classList.add('dark')
  else document.documentElement.classList.remove('dark')
})
// Local state for editing to enable explicit saving
const localSettings = reactive(cloneDeep(settings.value))
const saveStatus = ref('')
const syncConnectStatus = ref('')
const isJustSaved = ref(false)
let saveTimeout: number | undefined
let saveResetTimeout: number | undefined

// --- 快捷键设置 ---
const videoMarkShortcut = ref('Ctrl+Shift+L')
const shortcutError = ref('')
const shortcutSuccess = ref('')

onMounted(async () => {
  try {
    const commands = await browser.commands.getAll()
    const cmd = commands.find(c => c.name === VIDEO_MARK_COMMAND)
    if (cmd?.shortcut)
      videoMarkShortcut.value = cmd.shortcut
  }
  catch {
    // ignore
  }
})

async function updateVideoMarkShortcut() {
  shortcutError.value = ''
  shortcutSuccess.value = ''
  try {
    await browser.commands.update({
      name: VIDEO_MARK_COMMAND,
      shortcut: videoMarkShortcut.value.trim() || undefined,
    })
    shortcutSuccess.value = '快捷键已更新！'
    setTimeout(() => { shortcutSuccess.value = '' }, 2000)
  }
  catch (e: any) {
    shortcutError.value = e.message || '格式无效，请检查快捷键组合'
  }
}

// Watch for external changes to settings (e.g., sync) and update local state
watch(
  settings,
  (newSettings) => {
    Object.assign(localSettings, cloneDeep(newSettings))
  },
  { deep: true },
)

const blacklistText = computed({
  get: () => localSettings.blacklist.join('\n'),
  set: (value) => {
    localSettings.blacklist = value
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
  },
})

const alertInfo = reactive({
  visible: false,
  title: '提示',
  message: '',
  isHtml: false,
})

function showAlert(message: string, title = '提示', isHtml = false) {
  alertInfo.title = title
  alertInfo.message = message
  alertInfo.isHtml = isHtml
  alertInfo.visible = true
}

function hideAlert() {
  alertInfo.visible = false
}

function showSyncHelp() {
  showAlert(t('sync.helpContent'), t('sync.helpTitle'), true)
}

function addColor() {
  localSettings.highlightColors.push('#000000')
}

function removeColor(index: number) {
  if (localSettings.highlightColors.length <= 1) {
    showAlert('至少需要保留一种高亮颜色。')
    return
  }
  // If removing the default color, set a new default
  if (localSettings.highlightColors[index] === localSettings.defaultHighlightColor)
    localSettings.defaultHighlightColor = localSettings.highlightColors[index === 0 ? 1 : 0]

  localSettings.highlightColors.splice(index, 1)
}

async function saveSettings() {
  settings.value = cloneDeep(localSettings)
  saveStatus.value = '设置已保存！'
  isJustSaved.value = true
  clearTimeout(saveTimeout)
  clearTimeout(saveResetTimeout)
  saveTimeout = window.setTimeout(() => {
    saveStatus.value = ''
  }, 2000)
  saveResetTimeout = window.setTimeout(() => {
    isJustSaved.value = false
  }, 2000)
  // 通知 background 脚本设置已更新，以便它可以广播刷新指令
  sendMessage('refresh-sidepanel-data', {}, 'background').catch(() => {
    // 忽略错误
  })
}

async function exportLogs() {
  const logs = await getLogs()
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `error-logs-${Date.now()}.json`
  a.click()
}

function withTimeout<T>(promise: Promise<T>, ms: number, reason: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(reason)), ms)
  })
  return Promise.race([promise, timeout])
}

async function connectSync() {
  if (!syncConfig.value.token) {
    showAlert('请先输入 GitHub Token')
    return
  }

  syncConnectStatus.value = '正在连接 GitHub...'

  try {
    await Promise.all([dataReady, tagsReady, syncReady])

    // Wake up service worker before sending sync message (MV3 reliability)
    try {
      await browser.runtime.getPlatformInfo()
    }
    catch {
      // ignore
    }

    const gists = await getGists(syncConfig.value.token)
    // 查找包含 videomark_sync.json 的 Gist
    const existingGist = gists.find(g => g.files && g.files['videomark_sync.json'])

    if (existingGist) {
      syncConfig.value.gistId = existingGist.id
      // 先强制拉取并合并远程数据，成功后再启用自动同步，防止本地空数据覆盖远程
      // webext-bridge 在 MV3 下有时不返回响应，加超时避免 UI 卡住
      try {
        await triggerPull({ force: true, token: syncConfig.value.token, gistId: existingGist.id })
        syncConfig.value.enabled = true
        showAlert('已成功连接到现有的同步 Gist！')
      }
      catch (err: any) {
        // 拉取失败时重置 gistId，避免用户下次手动启用同步时使用了错误/未验证的 Gist ID
        syncConfig.value.gistId = ''
        throw err
      }
    }
    else {
      // 创建新的
      const newGist = await createGist(syncConfig.value.token, {
        marks: marksByUrl.value,
        tags: tagsMetadata.value,
        lastSync: Date.now(),
      })
      syncConfig.value.gistId = newGist.id
      syncConfig.value.enabled = true
      showAlert('已创建新的同步 Gist 并开启同步！')
      // 新 Gist 创建后拉取一次，以将 lastSyncStatus 置为 success，后续推送才能正常进行
      triggerPull({ force: true, token: syncConfig.value.token, gistId: newGist.id }).catch((err: any) => {
        console.error('[Options] trigger-sync failed:', err)
      })
    }
  }
  catch (err: any) {
    showAlert(`连接失败: ${err.message}`)
  }
  finally {
    syncConnectStatus.value = ''
  }
}

async function triggerPull({ force = false, timeoutMs = 8000, token = '', gistId = '' } = {}) {
  const payload = { force, token, gistId }
  console.log('[Options] triggerPull started', { force, hasToken: !!token, hasGistId: !!gistId })
  try {
    const result = await withTimeout(
      sendMessage('trigger-sync', payload, 'background'),
      timeoutMs,
      'trigger-sync timeout',
    )
    console.log('[Options] webext-bridge trigger-sync succeeded:', result)
    return result
  }
  catch (bridgeError: any) {
    console.warn('[Options] webext-bridge trigger-sync failed, falling back to runtime message:', bridgeError)
    const fallbackResult = await withTimeout(
      browser.runtime.sendMessage({ type: 'trigger-sync-pull', ...payload }),
      timeoutMs,
      'trigger-sync-pull timeout',
    )
    console.log('[Options] runtime fallback trigger-sync-pull result:', fallbackResult)
    return fallbackResult
  }
}

// ========== 左侧导航与 Scroll Spy ==========
const navItems = [
  { id: 'welcome', label: '欢迎使用' },
  { id: 'shortcuts', label: '快捷键设置' },
  { id: 'video-mark', label: '视频标记设置' },
  { id: 'blacklist', label: '网站黑名单' },
  { id: 'error-logs', label: '错误日志' },
  { id: 'github-sync', label: 'GitHub 同步' },
  { id: 'about', label: '关于' },
]

const activeSection = ref('welcome')

let isClickScrolling = false
let clickScrollTimeout: number | undefined
let clickTargetId: string | null = null
let rafId: number | null = null

function isElementInViewport(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  return rect.top < window.innerHeight && rect.bottom > 0
}

function scrollToSection(id: string) {
  activeSection.value = id
  clickTargetId = id
  isClickScrolling = true
  clearTimeout(clickScrollTimeout)
  clickScrollTimeout = window.setTimeout(() => {
    isClickScrolling = false
    const target = clickTargetId ? document.getElementById(clickTargetId) : null
    // 如果目标元素仍在视口中，保持高亮目标；否则按滚动位置校正
    if (target && isElementInViewport(target)) {
      activeSection.value = clickTargetId!
    }
    else {
      updateActiveSection()
    }
    clickTargetId = null
  }, 1000)
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function updateActiveSection() {
  const sections = navItems.map(item => ({
    id: item.id,
    offsetTop: document.getElementById(item.id)?.offsetTop ?? 0,
  }))
  activeSection.value = getActiveSectionId(
    window.scrollY,
    window.innerHeight,
    document.documentElement.scrollHeight,
    sections,
  )
}

function onScroll() {
  if (isClickScrolling)
    return
  if (rafId)
    return
  rafId = requestAnimationFrame(() => {
    updateActiveSection()
    rafId = null
  })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  updateActiveSection()
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  clearTimeout(clickScrollTimeout)
  if (rafId)
    cancelAnimationFrame(rafId)
})
</script>

<template>
  <main class="w-full max-w-[1100px] mx-auto px-[16px] py-[40px] text-gray-700 dark:text-gray-200 min-h-screen">
    <div class="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-[32px]">
      <!-- 左侧导航 -->
      <aside class="hidden md:block">
        <div class="sticky top-[40px] self-start">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-[16px]">
            <h1 class="text-[20px] font-bold mb-[16px] text-gray-900 dark:text-gray-100">
              设置
            </h1>
            <nav class="space-y-1">
              <button
                v-for="item in navItems"
                :key="item.id"
                class="w-full text-left px-[12px] py-[8px] rounded-md text-[14px] transition-colors relative"
                :class="activeSection === item.id
                  ? 'text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'"
                @click="scrollToSection(item.id)"
              >
                <span
                  v-if="activeSection === item.id"
                  class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-blue-500 rounded-r-full"
                />
                {{ item.label }}
              </button>
            </nav>
            <div class="mt-[16px] pt-[16px] border-t border-gray-100 dark:border-gray-700">
              <button
                class="w-full px-[16px] py-[8px] text-[14px] font-medium rounded-md transition-colors"
                :class="isJustSaved
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-blue-600 text-white hover:bg-blue-700'"
                :disabled="isJustSaved"
                @click="saveSettings"
              >
                {{ isJustSaved ? '已保存 ✓' : '保存设置' }}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <!-- 右侧内容 -->
      <div class="space-y-8">
        <!-- Welcome Guide -->
        <div id="welcome" class="setting-card border-l-4 border-blue-500 scroll-mt-8">
          <h2 class="text-[18px] font-semibold mb-[16px] flex items-center gap-2">
            👋 欢迎使用 VideoMark
          </h2>
          <div class="space-y-4 text-[14px]">
            <!-- Quick Start -->
            <div class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
              <h3 class="font-bold text-gray-900 dark:text-gray-100 mb-1">
                🚀 快速开始
              </h3>
              <p class="text-gray-600 dark:text-gray-300">
                在任意网页观看视频时，按下
                <kbd class="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-600 font-mono text-xs border border-gray-300 dark:border-gray-500">Ctrl+Shift+L</kbd>
                即可标记当前视频时间点。打开侧边栏可查看所有标记。
              </p>
            </div>

            <!-- Core Features -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <h3 class="font-bold text-gray-900 dark:text-gray-100 mb-1">
                  ✨ 核心功能
                </h3>
                <ul class="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
                  <li>
                    <strong>视频标记</strong>
                    ：一键记录精彩时刻
                  </li>
                  <li>
                    <strong>缩略图</strong>
                    ：直播自动截图留存
                  </li>
                </ul>
              </div>
              <div>
                <h3 class="font-bold text-gray-900 dark:text-gray-100 mb-1">
&nbsp;
                </h3>
                <ul class="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
                  <li>
                    <strong>时间回跳</strong>
                    ：点击标记瞬间定位
                  </li>
                  <li>
                    <strong>备注整理</strong>
                    ：为每个标记添加笔记
                  </li>
                </ul>
              </div>
            </div>

            <!-- Acknowledgments -->
            <div class="pt-2 border-t border-gray-100 dark:border-gray-700">
              <h3 class="font-bold text-gray-900 dark:text-gray-100 mb-1">
                ❤️ 致谢与支持
              </h3>
              <p class="text-gray-600 dark:text-gray-400 mb-2">
                感谢您的使用！如果您觉得这个工具对您有帮助，欢迎分享给朋友。
              </p>
              <div class="flex gap-4">
                <a
                  href="https://github.com/catx1726/web-video-mark"
                  target="_blank"
                  class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                >
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Shortcut Settings -->
        <div id="shortcuts" class="setting-card scroll-mt-8">
          <h2 class="text-[18px] font-semibold mb-[12px]">
            快捷键
          </h2>
          <p class="text-[14px] text-gray-500 mb-[16px]">
            视频标记的快捷键可直接在此修改。格式示例：<code class="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">Ctrl+Shift+Y</code>、<code class="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">Alt+L</code>。
          </p>
          <div class="space-y-4">
            <div class="flex items-center gap-[16px]">
              <label class="w-[96px] shrink-0">视频标记:</label>
              <div class="flex-1 flex items-center gap-2">
                <input
                  v-model="videoMarkShortcut"
                  type="text"
                  class="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 font-mono text-sm border border-gray-300 dark:border-gray-500 w-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="Ctrl+Shift+L"
                  @keydown.enter.prevent="updateVideoMarkShortcut"
                >
                <button
                  class="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                  @click="updateVideoMarkShortcut"
                >
                  更新
                </button>
              </div>
            </div>
            <p v-if="shortcutError" class="text-sm text-red-500">
              {{ shortcutError }}
            </p>
            <p v-if="shortcutSuccess" class="text-sm text-green-600">
              {{ shortcutSuccess }}
            </p>
            <div class="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md text-[13px] text-amber-800 dark:text-amber-400">
              <strong>⚠️ 提示：</strong>部分组合键（如 Firefox 中的 <code class="font-mono">Ctrl+Shift+L</code>）可能与浏览器内置快捷键冲突。如遇冲突，请尝试其他组合（如 <code class="font-mono">Ctrl+Shift+Y</code>），或前往浏览器扩展管理页面自定义。
            </div>
            <div class="flex items-center gap-[16px]">
              <label class="w-[96px] shrink-0">打开侧边栏:</label>
              <div class="flex-1 flex items-center gap-2">
                <span class="text-[13px] text-gray-500">点击浏览器工具栏上的扩展图标即可打开侧边栏</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Video Mark Settings -->
        <div id="video-mark" class="setting-card scroll-mt-8">
          <h2 class="text-[18px] font-semibold mb-[12px] flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
            </svg>
            视频标记设置
          </h2>
          <p class="text-[14px] text-gray-500 mb-[16px]">
            配置视频时间点标记的外观和截图行为。
          </p>

          <div class="space-y-5">
            <!-- 默认颜色 -->
            <div class="flex items-center gap-[16px]">
              <label class="w-[96px] shrink-0">默认颜色:</label>
              <div class="flex items-center gap-[12px]">
                <input
                  v-model="localSettings.videoMarkColor"
                  type="color"
                  class="h-8 w-12 p-[4px] border rounded"
                >
                <input
                  v-model="localSettings.videoMarkColor"
                  type="text"
                  class="px-[8px] py-[4px] border rounded-md bg-gray-50 dark:bg-gray-800 w-28"
                >
              </div>
            </div>

            <!-- 弹框策略 -->
            <div>
              <label class="block mb-2 text-[14px] font-medium text-gray-700 dark:text-gray-300">弹框策略</label>
              <p class="text-[13px] text-gray-500 mb-3">
                标记视频后是否弹出备注输入框。
              </p>
              <div class="space-y-2">
                <label class="flex items-start gap-2 cursor-pointer">
                  <input
                    v-model="localSettings.notePopupStrategy"
                    type="radio"
                    value="always"
                    class="mt-0.5 h-4 w-4"
                  >
                  <div>
                    <span class="text-[14px] text-gray-700 dark:text-gray-200">总是弹窗</span>
                    <p class="text-[12px] text-gray-500">无论是否全屏，标记后都弹出备注框。</p>
                  </div>
                </label>
                <label class="flex items-start gap-2 cursor-pointer">
                  <input
                    v-model="localSettings.notePopupStrategy"
                    type="radio"
                    value="skip-fullscreen"
                    class="mt-0.5 h-4 w-4"
                  >
                  <div>
                    <span class="text-[14px] text-gray-700 dark:text-gray-200">仅全屏状态不弹窗</span>
                    <p class="text-[12px] text-gray-500">全屏观看时不弹框，避免遮挡视频内容。</p>
                  </div>
                </label>
                <label class="flex items-start gap-2 cursor-pointer">
                  <input
                    v-model="localSettings.notePopupStrategy"
                    type="radio"
                    value="never"
                    class="mt-0.5 h-4 w-4"
                  >
                  <div>
                    <span class="text-[14px] text-gray-700 dark:text-gray-200">从不弹窗</span>
                    <p class="text-[12px] text-gray-500">标记后仅显示 Toast 提示，不弹框。</p>
                  </div>
                </label>
              </div>
            </div>

            <!-- 截图策略 -->
            <div>
              <label class="block mb-2 text-[14px] font-medium text-gray-700 dark:text-gray-300">截图策略</label>
              <p class="text-[13px] text-gray-500 mb-3">
                标记视频时是否自动截取当前画面。
              </p>
              <div class="space-y-2">
                <label class="flex items-start gap-2 cursor-pointer">
                  <input
                    v-model="localSettings.screenshotStrategy"
                    type="radio"
                    value="live-only"
                    class="mt-0.5 h-4 w-4"
                  >
                  <div>
                    <span class="text-[14px] text-gray-700 dark:text-gray-200">仅直播时截图（推荐）</span>
                    <p class="text-[12px] text-gray-500">普通视频不截图以节省空间；直播强制截图，因为事后无法跳转回看。</p>
                  </div>
                </label>
                <label class="flex items-start gap-2 cursor-pointer">
                  <input
                    v-model="localSettings.screenshotStrategy"
                    type="radio"
                    value="always"
                    class="mt-0.5 h-4 w-4"
                  >
                  <div>
                    <span class="text-[14px] text-gray-700 dark:text-gray-200">始终截图</span>
                    <p class="text-[12px] text-gray-500">每次标记都截取缩略图（约 15~30KB/张），方便快速回顾。</p>
                  </div>
                </label>
                <label class="flex items-start gap-2 cursor-pointer">
                  <input
                    v-model="localSettings.screenshotStrategy"
                    type="radio"
                    value="never"
                    class="mt-0.5 h-4 w-4"
                  >
                  <div>
                    <span class="text-[14px] text-gray-700 dark:text-gray-200">从不截图</span>
                    <p class="text-[12px] text-gray-500">仅保存时间戳，最省空间。点击标记即可跳转回视频对应位置。</p>
                  </div>
                </label>
              </div>
            </div>

            <!-- 截图质量与尺寸 -->
            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block mb-1 text-[13px] font-medium text-gray-700 dark:text-gray-300">宽度 (px)</label>
                <input
                  v-model.number="localSettings.screenshotWidth"
                  type="number"
                  min="160"
                  max="1920"
                  step="10"
                  class="w-full px-[8px] py-[6px] border rounded-md bg-gray-50 dark:bg-gray-800 text-sm"
                >
              </div>
              <div>
                <label class="block mb-1 text-[13px] font-medium text-gray-700 dark:text-gray-300">高度 (px)</label>
                <input
                  v-model.number="localSettings.screenshotHeight"
                  type="number"
                  min="90"
                  max="1080"
                  step="10"
                  class="w-full px-[8px] py-[6px] border rounded-md bg-gray-50 dark:bg-gray-800 text-sm"
                >
              </div>
              <div>
                <label class="block mb-1 text-[13px] font-medium text-gray-700 dark:text-gray-300">JPEG 质量</label>
                <input
                  v-model.number="localSettings.screenshotQuality"
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  class="w-full h-9 accent-blue-600"
                >
                <div class="text-center text-[12px] text-gray-500 mt-0.5">
                  {{ Math.round(localSettings.screenshotQuality * 100) }}%
                </div>
              </div>
            </div>

            <!-- 提示说明 -->
            <div class="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md text-[13px] text-amber-800 dark:text-amber-400">
              <strong>💡 提示：</strong>部分视频网站（如 Netflix、Disney+）受 DRM/CORS 保护，截图功能可能不可用。
            </div>
          </div>
        </div>

        <!-- Blacklist -->
        <div id="blacklist" class="setting-card scroll-mt-8">
          <h2 class="text-[18px] font-semibold mb-[12px]">
            网站黑名单
          </h2>
          <p class="text-[14px] text-gray-500 mb-[16px]">
            在以下网站禁用此插件，每行输入一个域名（例如 example.com）。
          </p>
          <textarea
            v-model="blacklistText"
            rows="5"
            class="w-full p-[8px] border rounded-md bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
            placeholder="google.com&#10;github.com"
          />
        </div>

        <!-- Error Logs -->
        <div id="error-logs" class="setting-card scroll-mt-8">
          <h2 class="text-[18px] font-semibold mb-[12px]">
            错误日志
          </h2>
          <p class="text-[14px] text-gray-500 mb-[16px]">
            如果扩展运行异常，请导出错误日志发送给我们。
          </p>
          <button
            class="px-[16px] py-2 text-[14px] font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700"
            @click="exportLogs"
          >
            导出错误日志
          </button>
        </div>

        <!-- GitHub Sync -->
        <div id="github-sync" class="setting-card scroll-mt-8">
          <div class="flex justify-between items-center mb-[12px]">
            <h2 class="text-[18px] font-semibold">
              GitHub 同步
            </h2>
            <button
              class="text-blue-500 hover:text-blue-700 flex items-center gap-1 text-[13px]"
              @click="showSyncHelp"
            >
              <div class="i-carbon-help text-[16px]" />
              使用指南
            </button>
          </div>
          <p class="text-[14px] text-gray-500 mb-[16px]">
            使用 GitHub Gist 实现多端标记同步。数据以私有 Gist 形式存储。
          </p>
          <div class="space-y-4">
            <div class="flex flex-col gap-2">
              <label class="text-[14px] font-medium">GitHub Personal Access Token (classic)</label>
              <input
                v-model="syncConfig.token"
                type="password"
                class="w-full px-[8px] py-[4px] border rounded-md bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxx"
              >
              <p class="text-[12px] text-gray-400">
                请确保 Token 已勾选 <strong>'gist'</strong> 权限（无需 repo 权限）。
                <a
                  href="https://github.com/settings/tokens/new?scopes=gist&description=VideoMark-Sync"
                  target="_blank"
                  class="text-blue-500 hover:underline"
                >
                  点此快速生成 Token
                </a>
              </p>
              <p class="text-[11px] text-amber-600/80 mt-1">
                ⚠️ 注意：Token 将以加密/私有形式存储在浏览器本地，建议使用最小权限。
              </p>
            </div>

            <div class="flex items-center gap-4">
              <button
                class="px-[16px] py-2 text-[14px] font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                :disabled="!syncConfig.token"
                @click="connectSync"
              >
                {{ syncConfig.gistId ? '重新连接' : '连接并开启同步' }}
              </button>
              <div v-if="syncConfig.gistId" class="flex flex-col">
                <span class="text-[12px] font-medium" :class="syncStatus.lastSyncStatus === 'error' ? 'text-red-500' : 'text-green-600'">
                  ● {{ syncStatus.lastSyncStatus === 'error' ? '同步失败' : '已连接到云端同步' }}
                </span>
                <span class="text-[11px] text-gray-400">上次同步: {{ syncStatus.lastSyncTime ? new Date(syncStatus.lastSyncTime).toLocaleString() : '从未' }}</span>
                <p v-if="syncStatus.errorMessage" class="text-[11px] text-red-400 mt-1">
                  {{ syncStatus.errorMessage }}
                </p>
              </div>
            </div>

            <div v-if="syncConfig.gistId" class="pt-2 border-t border-gray-100 dark:border-gray-700">
              <label class="flex items-center gap-2 cursor-pointer">
                <input v-model="syncConfig.enabled" type="checkbox" class="h-4 w-4">
                <span class="text-[14px]">启用自动同步</span>
              </label>
            </div>
          </div>
        </div>

        <!-- About -->
        <div id="about" class="setting-card scroll-mt-8">
          <h2 class="text-[18px] font-semibold mb-[12px]">
            关于
          </h2>
          <p class="text-[14px] text-gray-500">
            VideoMark v0.1.0 — 在网页视频中标记精彩时刻。
          </p>
          <p class="text-[13px] text-gray-400 mt-2">
            数据全部存储在浏览器本地，无需登录，保护隐私。
          </p>
        </div>
      </div>
    </div>

    <!-- 弹窗提示 -->
    <div
      v-if="alertInfo.visible"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="hideAlert"
    >
      <div
        class="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-[24px] w-full max-w-md text-gray-800 dark:text-gray-200"
      >
        <h3 class="text-[18px] font-semibold mb-[16px]">
          {{ alertInfo.title }}
        </h3>
        <div v-if="alertInfo.isHtml" class="text-[14px] mb-[24px]" v-html="alertInfo.message" />
        <p v-else class="text-[14px] mb-[24px]">
          {{ alertInfo.message }}
        </p>
        <div class="flex justify-end">
          <button
            class="px-[16px] py-2 text-[14px] font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            @click="hideAlert"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.setting-card {
  @apply bg-white dark:bg-gray-800 p-[24px] rounded-lg shadow-md;
}

/* 确保平滑滚动生效 */
html {
  scroll-behavior: smooth;
}
</style>
