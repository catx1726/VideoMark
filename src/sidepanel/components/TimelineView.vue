<script setup lang="ts">
import { computed, ref } from 'vue'
import TimelineCard from './TimelineCard.vue'
import type { Mark } from '~/logic/storage'

const props = defineProps<{
  marks: Mark[]
  url: string
  expandedTexts: Set<string>
  expandedNotes: Set<string>
  editingMarkId: string | null
  activeMarkMenu: string | null
}>()

const emit = defineEmits<{
  (e: 'goto', mark: Mark): void
  (e: 'edit', mark: Mark): void
  (e: 'save', mark: Mark, note: string): void
  (e: 'cancel'): void
  (e: 'remove', mark: Mark): void
  (e: 'copy', mark: Mark): void
  (e: 'toggle-expand', markId: string): void
  (e: 'toggle-note-expand', markId: string): void
  (e: 'toggle-menu', markId: string): void
  (e: 'open-tag-picker', mark: Mark): void
}>()

// ── 进度条 ──
const trackDuration = computed(() => {
  // 优先用标记中存储的 duration
  const stored = props.marks.map(m => m.duration).filter((d): d is number => !!d)
  if (stored.length > 0)
    return Math.max(...stored)
  // 兜底：用最大 timestamp * 1.1
  const maxTs = Math.max(...props.marks.map(m => m.timestamp || 0))
  return maxTs > 0 ? maxTs * 1.1 : 1
})

function getMarkPercent(mark: Mark): number {
  if (!mark.timestamp || !trackDuration.value)
    return 0
  return Math.min(100, Math.max(0, (mark.timestamp / trackDuration.value) * 100))
}

// Tooltip
const tooltip = ref<{ text: string, detail: string, left: number, visible: boolean }>({
  text: '',
  detail: '',
  left: 0,
  visible: false,
})
const trackRef = ref<HTMLElement | null>(null)
const hoveredMarkId = ref<string | null>(null)

function onTrackHover(e: MouseEvent) {
  if (!trackRef.value)
    return
  const rect = trackRef.value.getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  const time = percent * trackDuration.value

  // 检查是否悬停在某个标记点附近（更大的容差：16px）
  let nearMark: Mark | null = null
  const pixelTolerance = 10
  for (const mark of props.marks) {
    const markPercent = getMarkPercent(mark)
    const markPixel = (markPercent / 100) * rect.width
    const mousePixel = e.clientX - rect.left
    if (Math.abs(markPixel - mousePixel) <= pixelTolerance) {
      nearMark = mark
      break
    }
  }

  if (nearMark) {
    hoveredMarkId.value = nearMark.id
    tooltip.value = {
      text: nearMark.text,
      detail: nearMark.note || '点击跳转',
      left: e.clientX - rect.left,
      visible: true,
    }
  }
  else {
    hoveredMarkId.value = null
    tooltip.value = {
      text: formatTime(time),
      detail: '',
      left: e.clientX - rect.left,
      visible: true,
    }
  }
}

function onTrackLeave() {
  tooltip.value.visible = false
  hoveredMarkId.value = null
}

function onTrackClick(e: MouseEvent) {
  if (!trackRef.value)
    return
  const rect = trackRef.value.getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  // 找到最近的标记并跳转
  const targetTime = percent * trackDuration.value
  let closestMark: Mark | null = null
  let minDiff = Infinity
  for (const mark of props.marks) {
    const ts = mark.timestamp || 0
    const diff = Math.abs(ts - targetTime)
    if (diff < minDiff) {
      minDiff = diff
      closestMark = mark
    }
  }
  if (closestMark && minDiff < trackDuration.value * 0.05) {
    // 5% 容差内认为是点击了某个标记
    emit('goto', closestMark)
  }
}

function formatTime(seconds: number): string {
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
</script>

<template>
  <div class="space-y-3">
    <!-- 迷你进度条 -->
    <div class="relative">
      <div
        ref="trackRef"
        class="h-10 w-full rounded-lg bg-gray-200 dark:bg-gray-700 relative cursor-pointer overflow-hidden select-none"
        @mousemove="onTrackHover"
        @mouseleave="onTrackLeave"
        @click="onTrackClick"
      >
        <!-- 背景渐变 -->
        <div class="absolute inset-0 bg-gradient-to-r from-gray-300/50 via-transparent to-gray-300/50 dark:from-gray-600/30 dark:to-gray-600/30" />

        <!-- 标记点 hit area（宽大，便于 hover/点击） -->
        <div
          v-for="mark in marks"
          :key="mark.id"
          class="absolute top-0 h-full flex items-center justify-center z-10"
          style="width: 20px; transform: translateX(-50%);"
          :style="{ left: `${getMarkPercent(mark)}%` }"
        >
          <!-- 可见标记点 -->
          <div
            class="w-1.5 h-7 rounded-sm transition-all duration-150"
            :class="hoveredMarkId === mark.id ? 'scale-125' : ''"
            :style="{
              backgroundColor: mark.color || '#3B82F6',
              boxShadow: hoveredMarkId === mark.id
                ? `0 0 8px ${mark.color || '#3B82F6'}`
                : `0 0 4px ${mark.color || '#3B82F6'}`,
            }"
          />
        </div>

        <!-- 悬停 tooltip（放在进度条内部上方） -->
        <div
          v-if="tooltip.visible"
          class="absolute top-0 left-0 pointer-events-none z-20"
          :style="{ left: `${tooltip.left}px`, transform: 'translateX(-50%) translateY(-115%)' }"
        >
          <div class="bg-black/85 text-white text-[11px] px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
            <div class="font-semibold">{{ tooltip.text }}</div>
            <div v-if="tooltip.detail" class="text-[10px] opacity-80 max-w-[160px] truncate">
              {{ tooltip.detail }}
            </div>
          </div>
        </div>
      </div>

      <!-- 起止时间标签 -->
      <div class="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-1 px-1">
        <span>00:00</span>
        <span>{{ formatTime(trackDuration) }}</span>
      </div>
    </div>

    <!-- 卡片流 -->
    <div class="space-y-2">
      <TimelineCard
        v-for="mark in marks"
        :key="mark.id"
        :mark="mark"
        :is-expanded="expandedTexts.has(mark.id)"
        :is-note-expanded="expandedNotes.has(mark.id)"
        :is-editing="editingMarkId === mark.id"
        :active-menu="activeMarkMenu"
        @goto="m => emit('goto', m)"
        @edit="m => emit('edit', m)"
        @save="(m, note) => emit('save', m, note)"
        @cancel="() => emit('cancel')"
        @remove="m => emit('remove', m)"
        @copy="m => emit('copy', m)"
        @toggle-expand="id => emit('toggle-expand', id)"
        @toggle-note-expand="id => emit('toggle-note-expand', id)"
        @toggle-menu="id => emit('toggle-menu', id)"
        @open-tag-picker="m => emit('open-tag-picker', m)"
      />
    </div>

    <div v-if="marks.length === 0" class="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
      暂无视频标记
    </div>
  </div>
</template>
