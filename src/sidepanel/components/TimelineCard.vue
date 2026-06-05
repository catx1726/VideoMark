<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Mark } from '~/logic/storage'

const props = defineProps<{
  mark: Mark
  isExpanded: boolean
  isNoteExpanded: boolean
  isEditing: boolean
  activeMenu: string | null
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

const editingNote = ref(props.mark.note)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const previewImage = ref<string | null>(null)

watch(() => props.isEditing, async (newVal) => {
  if (newVal) {
    editingNote.value = props.mark.note
    await nextTick()
    textareaRef.value?.focus()
  }
})

function handleSave() {
  emit('save', props.mark, editingNote.value)
}

function formatDuration(seconds: number): string {
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

const hasScreenshot = computed(() => {
  return props.mark.screenshot && typeof props.mark.screenshot === 'string' && props.mark.screenshot.startsWith('data:')
})
</script>

<template>
  <div class="group relative flex gap-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-3 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/80">
    <!-- 左侧颜色条 -->
    <div
      class="w-1 flex-shrink-0 rounded-full self-stretch"
      :style="{ backgroundColor: mark.color || '#3B82F6' }"
    />

    <!-- 主体内容 -->
    <div class="min-w-0 flex-1 flex flex-col gap-2">
      <!-- 头部：时间戳 + 平台 + 菜单 -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <!-- 时间戳按钮（可点击跳转） -->
          <button
            class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold text-white flex-shrink-0 transition-transform hover:scale-105"
            :style="{ backgroundColor: mark.color || '#3B82F6' }"
            @click="emit('goto', mark)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
            </svg>
            {{ mark.isLive ? '● LIVE' : mark.text }}
          </button>

          <span
            v-if="mark.platform && mark.platform !== 'generic'"
            class="text-[11px] text-gray-400 dark:text-gray-500 capitalize flex-shrink-0"
          >
            {{ mark.platform }}
          </span>
          <span
            v-if="!mark.isLive && mark.duration"
            class="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0"
          >
            / {{ formatDuration(mark.duration) }}
          </span>
        </div>

        <!-- 菜单按钮 -->
        <div class="relative flex-shrink-0">
          <button
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            @click.stop="emit('toggle-menu', mark.id)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          <transition name="fade-scale">
            <div
              v-if="activeMenu === mark.id"
              class="bg-white border-gray-200 dark:bg-gray-700 dark:border-gray-600 absolute right-0 z-30 mt-1 w-40 rounded-md border shadow-lg"
              @click.stop
            >
              <div class="py-1">
                <button
                  class="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
                  @click="emit('open-tag-picker', mark)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.266 0 .52.105.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                  </svg>
                  管理标签
                </button>
                <button
                  class="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
                  @click="emit('copy', mark)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  复制标记
                </button>
                <div class="border-gray-100 dark:border-gray-600 my-1 border-t" />
                <button
                  class="hover:bg-red-50 dark:hover:bg-red-900/50 w-full px-3 py-1.5 text-left text-sm text-red-600 dark:text-red-400 flex items-center gap-2"
                  @click="emit('remove', mark)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  删除
                </button>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <!-- 截图 -->
      <div v-if="hasScreenshot" class="overflow-hidden rounded-md">
        <img
          :src="mark.screenshot"
          class="h-auto max-w-full object-contain cursor-zoom-in rounded-md"
          alt="视频截图"
          loading="lazy"
          @click.stop="previewImage = mark.screenshot!"
        >
      </div>

      <!-- 备注 -->
      <div v-if="isEditing" class="mt-1">
        <textarea
          ref="textareaRef"
          v-model="editingNote"
          class="border-gray-300 dark:bg-gray-700 dark:border-gray-600 w-full rounded-md p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          rows="2"
          placeholder="添加备注..."
          @keydown.enter.prevent="handleSave"
          @keydown.esc="emit('cancel')"
        />
        <div class="mt-2 flex justify-end gap-2">
          <button
            class="bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 rounded-md px-3 py-1 text-xs font-medium"
            @click.stop="emit('cancel')"
          >
            取消
          </button>
          <button
            class="bg-blue-600 hover:bg-blue-700 rounded-md px-3 py-1 text-xs font-medium text-white"
            @click.stop="handleSave"
          >
            保存
          </button>
        </div>
      </div>
      <p
        v-else
        :title="mark.note"
        class="text-gray-500 dark:text-gray-400 dark:hover:text-blue-400 cursor-pointer text-xs transition-colors hover:text-blue-600"
        @click.stop="emit('edit', mark)"
      >
        {{ mark.note || '点击添加备注...' }}
      </p>
    </div>

    <!-- 图片放大预览 overlay -->
    <div
      v-if="previewImage"
      class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      @click="previewImage = null"
    >
      <img
        :src="previewImage"
        class="max-w-full max-h-full object-contain rounded shadow-2xl"
        alt="预览"
      >
    </div>
  </div>
</template>
