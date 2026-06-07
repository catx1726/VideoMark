import { toRaw } from 'vue'
import { sendMessage } from 'webext-bridge/options'
import browser from 'webextension-polyfill'
import TurndownService from 'turndown'
import { marksByUrl } from '~/logic/storage'
import type { Mark } from '~/logic/storage'
import type { MarkGroup } from '~/logic/tagTree'

export function useMarkActions() {
  const turndownService = new TurndownService()
  turndownService.addRule('strikethrough', {
    filter: ['del', 's', 'strike' as any],
    replacement: content => `~~${content}~~`,
  })

  function getNormalizedUrl(url: string | URL): string {
    const urlObj = typeof url === 'string' ? new URL(url) : url
    let path = urlObj.pathname
    if (path.length > 1 && path.endsWith('/'))
      path = path.slice(0, -1)
    return urlObj.origin + path
  }

  async function gotoMark(mark: Mark) {
    // 视频标记使用不同的跳转逻辑
    if (mark.type === 'video') {
      await gotoVideoMark(mark)
      return
    }

    const allTabs = await browser.tabs.query({ currentWindow: true })
    const targetUrl = getNormalizedUrl(mark.url)
    const tab = allTabs.find((t) => {
      if (!t.url)
        return false
      try {
        return getNormalizedUrl(t.url) === targetUrl
      }
      catch {
        return false
      }
    })

    if (tab?.id) {
      await browser.tabs.update(tab.id, { active: true })
      sendMessage('goto-mark', { markId: mark.id }, { context: 'content-script', tabId: tab.id })
    }
    else {
      const urlWithHash = new URL(mark.url)
      urlWithHash.hash = `__highlight-mark__${mark.id}`
      await browser.tabs.create({ url: urlWithHash.href, active: true })
    }
  }

  async function gotoVideoMark(mark: Mark) {
    if (mark.isLive) {
      // eslint-disable-next-line no-alert
      alert('直播内容无法跳转回历史时间点，但已保存截图供回顾。')
    }

    const allTabs = await browser.tabs.query({ currentWindow: true })

    // 策略1：精确匹配（完整 URL）
    let tab = allTabs.find((t) => {
      if (!t.url)
        return false
      return t.url === mark.url
    })

    // 策略2：规范化匹配（去掉末尾斜杠）
    if (!tab) {
      const targetUrl = getNormalizedUrl(mark.url)
      tab = allTabs.find((t) => {
        if (!t.url)
          return false
        try {
          return getNormalizedUrl(t.url) === targetUrl
        }
        catch {
          return false
        }
      })
    }

    // 策略3：pathname 级别匹配（忽略查询参数差异，如 YouTube 的时间参数）
    if (!tab) {
      try {
        const markUrlObj = new URL(mark.url)
        const markBase = markUrlObj.origin + markUrlObj.pathname
        tab = allTabs.find((t) => {
          if (!t.url)
            return false
          try {
            const tabUrlObj = new URL(t.url)
            return tabUrlObj.origin + tabUrlObj.pathname === markBase
          }
          catch {
            return false
          }
        })
      }
      catch {
        // 忽略 URL 解析错误
      }
    }

    if (tab?.id) {
      await browser.tabs.update(tab.id, { active: true })
      sendMessage('goto-video-mark', {
        timestamp: mark.timestamp ?? 0,
        isLive: mark.isLive ?? false,
      } as any, { context: 'content-script', tabId: tab.id })
    }
    else {
      // 使用保存的完整 URL 打开新标签页
      await browser.tabs.create({ url: mark.url, active: true })
    }
  }

  async function removeMark(mark: Mark) {
    // eslint-disable-next-line no-alert
    if (!confirm('确定要删除此标记吗？'))
      return

    // 乐观删除：立即在本地标记为删除，UI 立刻响应
    let restored = false
    if (marksByUrl.value[mark.url]) {
      const m = marksByUrl.value[mark.url].find(m => m.id === mark.id)
      if (m && !m.deletedAt) {
        m.deletedAt = Date.now()
        restored = true
      }
    }

    try {
      const result = await sendMessage('remove-mark', toRaw(mark), 'background')
      if (result && (result as any).success === false) {
        console.error('Failed to remove mark:', (result as any)?.error)
        // 后台失败，恢复本地状态
        if (restored && marksByUrl.value[mark.url]) {
          const m = marksByUrl.value[mark.url].find(m => m.id === mark.id)
          if (m)
            delete m.deletedAt
        }
        return
      }
    }
    catch (error) {
      console.error('Failed to send remove-mark message:', error)
      // 网络/通信失败，恢复本地状态
      if (restored && marksByUrl.value[mark.url]) {
        const m = marksByUrl.value[mark.url].find(m => m.id === mark.id)
        if (m)
          delete m.deletedAt
      }
      return
    }

    // Notify content script to refresh track
    const allTabs = await browser.tabs.query({ currentWindow: true })
    const targetUrl = getNormalizedUrl(mark.url)
    const tab = allTabs.find((t) => {
      if (!t.url)
        return false
      try {
        return getNormalizedUrl(t.url) === targetUrl
      }
      catch {
        return false
      }
    })
    if (tab?.id) {
      sendMessage('refresh-mark-track', {}, { context: 'content-script', tabId: tab.id }).catch(() => {})
      sendMessage('remove-mark', toRaw(mark), { context: 'content-script', tabId: tab.id }).catch(() => {})
    }
  }

  async function saveNote(markId: string, url: string, note: string) {
    await sendMessage('update-mark-details', { id: markId, url, note }, 'background')
  }

  async function copyMarkText(mark: Mark) {
    try {
      await navigator.clipboard.writeText(`标记：${mark.text}\n` + `备注：${mark.note}`)
      return true
    }
    catch {
      return false
    }
  }

  // ── Export functions (video-mark optimized) ──
  function formatVideoMark(mark: Mark): string {
    const urlWithTime = mark.timestamp !== undefined
      ? `${mark.url}${mark.url.includes('?') ? '&' : '?'}t=${Math.floor(mark.timestamp)}`
      : mark.url
    let md = `> **[${mark.text}](${urlWithTime})**\n\n`
    if (mark.screenshot) {
      md += `![截图](${mark.screenshot})\n\n`
    }
    if (mark.note) {
      md += `**备注**：${mark.note}\n\n`
    }
    md += `---\n\n`
    return md
  }

  function exportToMarkdown(urlData: { pageTitle: string, groups: MarkGroup[] }) {
    const { pageTitle, groups } = urlData
    const firstMark = groups.length > 0 && groups[0].marks.length > 0 ? groups[0].marks[0] : null
    const pageURL = firstMark?.url || ''
    let markdown = `> 来源：[${pageTitle}](${pageURL})\n\n---\n\n`
    for (const group of groups) {
      markdown += `**${group.title}**\n\n`
      for (const mark of group.marks) {
        if (mark.type === 'video') {
          markdown += formatVideoMark(mark)
        }
        else if (mark.html) {
          try {
            const contentMd = turndownService.turndown(mark.html)
            markdown += `${contentMd}\n\n`
          }
          catch {
            markdown += `> ${mark.text.replace(/>/g, '\\>')}\n\n`
          }
        }
        else {
          markdown += `> ${mark.text.replace(/>/g, '\\>')}\n\n`
        }
        if (mark.note && mark.type !== 'video')
          markdown += `**备注**：${mark.note}\n\n`
        if (mark.type !== 'video')
          markdown += `---\n\n`
      }
    }
    downloadMarkdown(markdown, pageTitle)
  }

  function exportTagFolder(folder: { tagName: string, pages: Record<string, any> }) {
    let markdown = `**标签：${folder.tagName}**\n\n---\n\n`
    for (const [url, urlData] of Object.entries(folder.pages)) {
      const { pageTitle, groups } = urlData as any
      markdown += `**[${pageTitle}](${url})**\n\n`
      for (const group of groups) {
        markdown += `*${group.title}*\n\n`
        for (const mark of group.marks) {
          if (mark.type === 'video') {
            markdown += formatVideoMark(mark)
          }
          else if (mark.html) {
            try {
              markdown += `${turndownService.turndown(mark.html)}\n\n`
            }
            catch {
              markdown += `> ${mark.text.replace(/>/g, '\\>')}\n\n`
            }
          }
          else {
            markdown += `> ${mark.text.replace(/>/g, '\\>')}\n\n`
          }
          if (mark.note && mark.type !== 'video')
            markdown += `**备注**：${mark.note}\n\n`
          if (mark.type !== 'video')
            markdown += `---\n\n`
        }
      }
    }
    downloadMarkdown(markdown, folder.tagName)
  }

  function exportGroup(url: string, group: any) {
    let md = `**分组：${group.title}**\n\n---\n\n`
    for (const mark of group.marks) {
      if (mark.type === 'video') {
        md += formatVideoMark(mark)
      }
      else if (mark.html) {
        try {
          md += `${turndownService.turndown(mark.html)}\n\n`
        }
        catch {
          md += `> ${mark.text.replace(/>/g, '\\>')}\n\n`
        }
      }
      else {
        md += `> ${mark.text.replace(/>/g, '\\>')}\n\n`
      }
      if (mark.note && mark.type !== 'video')
        md += `**备注**：${mark.note}\n\n`
      if (mark.type !== 'video')
        md += `---\n\n`
    }
    downloadMarkdown(md, group.title)
  }

  function downloadMarkdown(content: string, fileName: string) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeFileName = fileName.replace(/[/\\?%*:|"<>]/g, '-')
    a.download = `${safeFileName}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    gotoMark,
    removeMark,
    saveNote,
    copyMarkText,
    exportToMarkdown,
    exportTagFolder,
    exportGroup,
    getNormalizedUrl,
  }
}
