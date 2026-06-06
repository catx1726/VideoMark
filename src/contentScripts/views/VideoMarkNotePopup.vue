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
    class="fixed rounded-lg bg-white shadow-2xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 font-sans"
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
      class="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 cursor-move select-none"
      @mousedown="startDrag"
    >
      <div class="flex items-center gap-2">
        <!-- 拖动把手 -->
        <div class="flex flex-col gap-1">
          <div class="w-4 h-0.5 bg-gray-300 dark:bg-gray-600 rounded" />
          <div class="w-4 h-0.5 bg-gray-300 dark:bg-gray-600 rounded" />
          <div class="w-4 h-0.5 bg-gray-300 dark:bg-gray-600 rounded" />
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-sm font-semibold text-gray-800 dark:text-gray-100">VideoMark</span>
          <span v-if="timestamp" class="text-xs text-gray-500 dark:text-gray-400 font-mono">{{ timestamp }}</span>
        </div>
      </div>

      <button
        class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
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
        class="w-full min-h-[120px] resize-y rounded-md border border-gray-300 p-3 text-sm leading-relaxed focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400 dark:focus:border-blue-400 dark:focus:ring-blue-400 outline-none"
        placeholder="在这里输入你的备注..."
        @keydown.esc="onCancel"
        @keydown.ctrl.enter="onSave"
        @keydown.meta.enter="onSave"
      />

      <!-- 按钮区域 -->
      <div class="flex justify-end gap-2 mt-3">
        <button
          class="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
          @click="onCancel"
        >
          取消
        </button>
        <button
          class="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm"
          @click="onSave"
        >
          保存
        </button>
      </div>
    </div>
  </div>
</template>
