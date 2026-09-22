<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

const emit = defineEmits<{
  (e: 'save', note: string): void
  (e: 'cancel'): void
}>()

const visible = ref(false)
const position = ref({ x: 0, y: 0 })
const noteValue = ref('')
const timestamp = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const popupWidth = 320
const popupHeight = 280
const bottomOffset = 120
const margin = 10

let isDragging = false
const dragOffset = { x: 0, y: 0 }

function calculateDefaultPosition() {
  const x = Math.max(margin, Math.min(window.innerWidth - popupWidth - margin, (window.innerWidth - popupWidth) / 2))
  const y = Math.max(margin, window.innerHeight - popupHeight - bottomOffset)
  return { x, y }
}

function show(initialTimestamp = '') {
  timestamp.value = initialTimestamp
  noteValue.value = ''
  const defaultPos = calculateDefaultPosition()
  position.value = defaultPos
  visible.value = true
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function hide() {
  visible.value = false
  noteValue.value = ''
}

function onSave() {
  emit('save', noteValue.value)
  hide()
}

function onCancel() {
  emit('cancel')
  hide()
}

function handleKeydown(event: KeyboardEvent) {
  if (!visible.value)
    return

  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    onCancel()
    return
  }

  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    event.stopPropagation()
    onSave()
  }
}

function startDrag(event: MouseEvent) {
  if (event.button !== 0)
    return

  isDragging = true
  dragOffset.x = event.clientX - position.value.x
  dragOffset.y = event.clientY - position.value.y

  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(event: MouseEvent) {
  if (!isDragging)
    return

  const newX = event.clientX - dragOffset.x
  const newY = event.clientY - dragOffset.y

  const maxX = window.innerWidth - popupWidth - margin
  const maxY = window.innerHeight - popupHeight - margin

  position.value = {
    x: Math.max(margin, Math.min(maxX, newX)),
    y: Math.max(margin, Math.min(maxY, newY)),
  }
}

function stopDrag() {
  isDragging = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown, true)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown, true)
})

defineExpose({ show, hide })
</script>

<template>
  <div
    v-if="visible"
    class="fixed rounded-lg bg-white shadow-2xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 font-sans"
    :style="{
      top: `${position.y}px`,
      left: `${position.x}px`,
      width: `${popupWidth}px`,
      zIndex: 99999,
    }"
    @mousedown.stop
  >
    <!-- 标题栏 -->
    <div
      class="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 cursor-move select-none"
      @mousedown="startDrag"
    >
      <div class="flex items-center gap-2">
        <!-- 拖动把手 -->
        <div class="flex flex-col gap-1">
          <div class="w-4 h-0.5 bg-neutral-300 dark:bg-neutral-600 rounded" />
          <div class="w-4 h-0.5 bg-neutral-300 dark:bg-neutral-600 rounded" />
          <div class="w-4 h-0.5 bg-neutral-300 dark:bg-neutral-600 rounded" />
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-sm font-semibold text-neutral-800 dark:text-neutral-100">VideoMark</span>
          <span v-if="timestamp" class="text-xs text-neutral-500 dark:text-neutral-400 font-mono">{{ timestamp }}</span>
        </div>
      </div>

      <button
        class="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700"
        @click="onCancel"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>

    <!-- 内容区域 -->
    <div class="p-4">
      <textarea
        ref="textareaRef"
        v-model="noteValue"
        class="w-full min-h-[120px] resize-y rounded-md border border-neutral-300 p-3 text-sm leading-relaxed focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-200 dark:placeholder-neutral-400 dark:focus:border-amber-400 dark:focus:ring-amber-400 outline-none"
        placeholder="在这里输入你的备注..."
        @keydown.esc="onCancel"
        @keydown.enter="onSave"
      />

      <!-- 按钮区域 -->
      <div class="flex justify-end gap-2 mt-3">
        <button
          class="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-700 rounded-md transition-colors"
          @click="onCancel"
        >
          取消
        </button>
        <button
          class="px-4 py-1.5 bg-amber-500 text-neutral-900 text-xs font-medium rounded-md hover:bg-amber-600 transition-colors shadow-sm"
          @click="onSave"
        >
          保存
        </button>
      </div>
    </div>
  </div>
</template>
