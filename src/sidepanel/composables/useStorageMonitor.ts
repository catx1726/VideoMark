import { computed, ref } from 'vue'
import { sendMessage } from 'webext-bridge/options'
import { CLEANUP_DAYS_THRESHOLD } from '~/logic/config'
import { marksByUrl } from '~/logic/storage'

export function useStorageMonitor() {
  const storageUsage = ref(0)
  const storageQuota = ref(0)

  const storageUsagePercent = computed(() => {
    if (!storageQuota.value)
      return 0
    return (storageUsage.value / storageQuota.value) * 100
  })

  async function refreshUsage() {
    const response = await sendMessage('get-storage-usage', undefined, 'background')
    if (response) {
      storageUsage.value = (response as any).usage || 0
      storageQuota.value = (response as any).quota || 0
    }
  }

  async function cleanupOldMarks() {
    // eslint-disable-next-line no-alert
    if (confirm(`确定要清理 ${CLEANUP_DAYS_THRESHOLD} 天前的所有标记吗？此操作不可撤销。`)) {
      const threshold = Date.now() - CLEANUP_DAYS_THRESHOLD * 24 * 60 * 60 * 1000
      // 乐观删除：立即在本地标记为删除
      Object.values(marksByUrl.value).forEach((marks) => {
        marks.forEach((m) => {
          if (m.createdAt < threshold && !m.deletedAt)
            m.deletedAt = Date.now()
        })
      })
      await sendMessage('cleanup-old-marks', { days: CLEANUP_DAYS_THRESHOLD }, 'background')
      await refreshUsage()
      return true
    }
    return false
  }

  async function cleanupUselessMarks() {
    // eslint-disable-next-line no-alert
    if (confirm('确定要清理所有没有备注的标记吗？此操作不可撤销。')) {
      // 乐观删除：立即在本地标记为删除
      Object.values(marksByUrl.value).forEach((marks) => {
        marks.forEach((m) => {
          if (!m.note?.trim() && !m.deletedAt)
            m.deletedAt = Date.now()
        })
      })
      await sendMessage('cleanup-useless-marks', {}, 'background')
      await refreshUsage()
      return true
    }
    return false
  }

  return {
    storageUsage,
    storageQuota,
    storageUsagePercent,
    refreshUsage,
    cleanupOldMarks,
    cleanupUselessMarks,
  }
}
