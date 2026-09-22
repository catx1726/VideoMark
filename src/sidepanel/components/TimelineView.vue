<script setup lang="ts">
import { computed, ref } from 'vue'
import TimelineCard from './TimelineCard.vue'
import { isPlaybackOnPage, usePlaybackPosition } from '../composables/usePlaybackPosition'
import { Z_LAYERS } from '~/logic/layers'
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

// ── 比例轨道刻度 ──
// 刻度按 timestamp/时长真实比例落点（顶部=00:00，底部=视频末尾），
// 与卡片流解耦：轨道是「分布总览」，卡片是「内容列表」。
const { playback } = usePlaybackPosition()

const trackDuration = computed(() => {
  const stored = props.marks.map(m => m.duration).filter((d): d is number => !!d)
  let scale = stored.length > 0 ? Math.max(...stored) : 0
  if (scale <= 0) {
    const maxTs = Math.max(...props.marks.map(m => m.timestamp || 0), 0)
    scale = maxTs > 0 ? maxTs * 1.1 : 1
  }
  // 播放中上报的真实时长优先（标记存储的 duration 可能过时）
  if (playback.value && isPlaybackOnPage(props.url) && playback.value.duration > scale)
    scale = playback.value.duration
  return scale
})

const tickMarks = computed(() => props.marks.filter(m => m.timestamp != null))

function getPercent(timestamp: number): number {
  return Math.min(100, Math.max(0, (timestamp / trackDuration.value) * 100))
}

// ── 播放头：当前播放位置（仅当播放页与本页匹配时显示） ──
const playheadPct = computed(() => {
  if (!playback.value || !isPlaybackOnPage(props.url))
    return null
  return getPercent(playback.value.currentTime)
})

// ── 交互：hover 预览 / 点击跳转 ──
const railRef = ref<HTMLElement | null>(null)
const hoveredMarkId = ref<string | null>(null)
const tooltip = ref<{ text: string, topPct: number } | null>(null)

function onTickEnter(mark: Mark) {
  hoveredMarkId.value = mark.id
  tooltip.value = {
    text: `${formatTime(mark.timestamp || 0)} ${mark.note || mark.text}`,
    topPct: getPercent(mark.timestamp || 0),
  }
}

function onRailLeave() {
  hoveredMarkId.value = null
  tooltip.value = null
}

function onRailClick(e: MouseEvent) {
  if (!railRef.value)
    return
  const rect = railRef.value.getBoundingClientRect()
  const pct = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
  // 点击空白处：跳转到对应时间点（合成最小 mark 复用 goto 链路）
  emit('goto', {
    id: '',
    url: props.url,
    type: 'video',
    timestamp: pct * trackDuration.value,
    isLive: false,
    text: '',
    createdAt: Date.now(),
  } as Mark)
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
  <div class="flex gap-3">
    <!-- 比例轨道：分布总览 + 播放头 + 点击跳转 -->
    <div
      ref="railRef"
      class="relative w-3 flex-shrink-0 self-stretch cursor-pointer select-none"
      title="点击跳转到对应时间点"
      @mouseleave="onRailLeave"
      @click="onRailClick"
    >
      <!-- 轨道线 -->
      <div class="absolute left-1/2 top-1 bottom-1 w-[3px] -translate-x-1/2 rounded-full bg-neutral-200 dark:bg-neutral-700" />

      <!-- 标记刻度（按时间比例落点） -->
      <button
        v-for="mark in tickMarks"
        :key="mark.id"
        class="absolute left-1/2 w-[9px] h-[3px] rounded-full transition-transform duration-150"
        :style="{
          top: `${getPercent(mark.timestamp || 0)}%`,
          transform: hoveredMarkId === mark.id ? 'translate(-50%, -50%) scale(1.8)' : 'translate(-50%, -50%)',
          backgroundColor: mark.color || '#F59E0B',
        }"
        @mouseenter="onTickEnter(mark)"
        @click.stop="emit('goto', mark)"
      />

      <!-- 播放头：当前播放位置 -->
      <div
        v-if="playheadPct !== null"
        class="absolute left-[-1px] right-[-1px] h-[2px] rounded bg-neutral-800 dark:bg-neutral-100 pointer-events-none"
        :style="{ top: `${playheadPct}%`, transform: 'translateY(-50%)' }"
        :title="`当前播放 ${formatTime(playback!.currentTime)}`"
      />

      <!-- hover 预览 tooltip -->
      <div
        v-if="tooltip"
        class="absolute left-4 pointer-events-none max-w-[180px] truncate bg-black/85 text-white text-[11px] px-2 py-1 rounded-md whitespace-nowrap"
        :style="{ top: `${tooltip.topPct}%`, transform: 'translateY(-50%)', zIndex: Z_LAYERS.menuElevated }"
      >
        {{ tooltip.text }}
      </div>
    </div>

    <!-- 卡片流（时间升序） -->
    <div class="flex-1 min-w-0 space-y-3">
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
      <div v-if="marks.length === 0" class="text-center py-6 text-neutral-400 dark:text-neutral-500 text-sm">
        暂无视频标记
      </div>
    </div>
  </div>
</template>
