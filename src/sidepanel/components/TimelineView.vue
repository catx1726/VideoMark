<script setup lang="ts">
import TimelineCard from './TimelineCard.vue'
import type { Mark } from '~/logic/storage'

defineProps<{
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
</script>

<template>
  <!-- 竖向时间轴：连续导轨 + 节点圆点 + 时间升序卡片流 -->
  <div class="relative space-y-3 pl-6">
    <div class="absolute left-[7px] top-2 bottom-2 w-px bg-neutral-200 dark:bg-neutral-700" aria-hidden="true" />

    <div v-for="mark in marks" :key="mark.id" class="relative">
      <!-- 节点圆点（落在导轨上，颜色跟随标记色） -->
      <div
        class="absolute -left-[21px] top-[15px] w-2.5 h-2.5 rounded-full"
        :style="{ backgroundColor: mark.color || '#F59E0B' }"
        aria-hidden="true"
      />
      <TimelineCard
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

    <div v-if="marks.length === 0" class="text-center py-6 text-neutral-400 dark:text-neutral-500 text-sm">
      暂无视频标记
    </div>
  </div>
</template>
