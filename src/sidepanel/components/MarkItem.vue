<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
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
</script>

<template>
  <li class="group relative flex items-start gap-2">
    <!-- 文本标记：颜色指示器 -->
    <div
      v-if="mark.type !== 'video'"
      class="color-indicator h-[20px] w-1 flex-shrink-0 rounded-full"
      :style="{ backgroundColor: mark.color }"
    />
    <!-- 视频标记：播放图标 -->
    <div
      v-else
      class="h-[20px] w-5 flex-shrink-0 flex items-center justify-center"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4"
        :style="{ color: mark.color }"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
          clip-rule="evenodd"
        />
      </svg>
    </div>

    <div class="min-w-0 flex-1">
      <!-- 视频标记头部信息 -->
      <div v-if="mark.type === 'video'" class="flex items-center gap-2 mb-1">
        <span
          class="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
          :style="{ backgroundColor: mark.color }"
        >
          {{ mark.isLive ? '● LIVE' : mark.text }}
        </span>
        <span
          v-if="mark.platform && mark.platform !== 'generic'"
          class="text-[11px] text-gray-400 dark:text-gray-500 capitalize"
        >
          {{ mark.platform }}
        </span>
        <span
          v-if="!mark.isLive && mark.duration"
          class="text-[11px] text-gray-400 dark:text-gray-500"
        >
          / {{ formatDuration(mark.duration) }}
        </span>
      </div>

      <div class="cursor-pointer" @click="emit('goto', mark)">
        <!-- 文本标记内容 -->
        <div
          v-if="mark.type !== 'video'"
          class="rich-text-content text-gray-800 dark:text-gray-200 ease-in-out max-w-none overflow-hidden text-sm font-medium transition-all duration-300"
          :class="isExpanded ? 'max-h-96' : 'max-h-5'"
          v-html="mark.html || mark.text"
        />
        <!-- 视频标记：缩略图 或 时间文本 -->
        <div
          v-else-if="mark.screenshot"
          class="mt-1 overflow-hidden rounded"
        >
          <img
            :src="mark.screenshot"
            class="h-auto max-h-24 max-w-full object-contain cursor-zoom-in"
            alt="视频截图"
            loading="lazy"
            @click.stop="previewImage = mark.screenshot"
          >
        </div>
        <div
          v-else
          class="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {{ mark.text }} — 点击跳转
        </div>
      </div>
      <div v-if="isEditing" class="mt-2">
        <textarea
          ref="textareaRef"
          v-model="editingNote"
          class="border-gray-300 dark:bg-gray-700 dark:border-gray-600 w-full rounded-md p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          @keydown.enter.prevent="handleSave"
          @keydown.esc="emit('cancel')"
        />
        <div class="mt-2 flex justify-end gap-2">
          <button
            class="action-button bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 rounded-md px-3 py-1 text-sm font-medium"
            @click.stop="emit('cancel')"
          >
            取消
          </button>
          <button
            class="action-button bg-blue-600 hover:bg-blue-700 rounded-md px-3 py-1 text-sm font-medium text-white"
            @click.stop="handleSave"
          >
            保存
          </button>
        </div>
      </div>
      <p
        v-else
        :title="mark.note"
        class="text-gray-500 dark:text-gray-400 dark:hover:text-blue-400 ease-in-out mt-1 cursor-pointer overflow-hidden text-xs transition-all duration-300 hover:text-blue-600"
        :class="isNoteExpanded ? 'max-h-96' : 'max-h-5'"
        @click.stop="emit('edit', mark)"
      >
        {{ mark.note || '点击添加备注...' }}
      </p>
    </div>
    <div class="relative flex-shrink-0">
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
      <button
        class="text-gray-400 hover:text-gray-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        title="更多操作"
        @click.stop="emit('toggle-menu', mark.id)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"
          />
        </svg>
      </button>

      <transition name="fade-scale">
        <div
          v-if="activeMenu === mark.id"
          class="bg-white border-gray-200 dark:bg-gray-700 dark:border-gray-600 absolute right-0 z-30 mt-2 w-48 rounded-md border shadow-lg"
          @click.stop
        >
          <div class="py-1">
            <button
              class="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex w-full items-center gap-2 px-4 py-2 text-left text-sm"
              @click="emit('toggle-expand', mark.id)"
            >
              <span>{{ isExpanded ? '收起标记' : '展开标记' }}</span>
            </button>
            <button
              v-if="mark.note"
              class="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex w-full items-center gap-2 px-4 py-2 text-left text-sm"
              @click="emit('toggle-note-expand', mark.id)"
            >
              <span>{{ isNoteExpanded ? '收起备注' : '展开备注' }}</span>
            </button>
            <div class="border-gray-100 dark:border-gray-600 my-1 border-t" />
            <button
              class="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 w-full px-4 py-2 text-left text-sm"
              @click="emit('open-tag-picker', mark)"
            >
              管理标签
            </button>

            <button
              class="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex w-full items-center gap-2 px-4 py-2 text-left text-sm"
              @click="emit('copy', mark)"
            >
              <span>复制标记</span>
            </button>
            <button
              class="hover:bg-red-50 dark:hover:bg-red-900/50 w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400"
              @click="emit('remove', mark)"
            >
              删除标记
            </button>
          </div>
        </div>
      </transition>
    </div>
  </li>
</template>
