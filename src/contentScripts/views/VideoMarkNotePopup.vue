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
    style="
      position: fixed;
      background: white;
      border-radius: 8px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      border: 1px solid #e5e7eb;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 99999;
    "
    :style="{
      top: `${position.y}px`,
      left: `${position.x}px`,
      width: `${popupWidth}px`,
    }"
    @mousedown.stop
  >
    <!-- 标题栏 -->
    <div
      style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid #f3f4f6;
        cursor: move;
        user-select: none;
      "
      @mousedown="startDrag"
    >
      <div style="display: flex; align-items: center; gap: 8px;">
        <!-- 拖动把手 -->
        <div style="display: flex; flex-direction: column; gap: 3px;">
          <div style="width: 16px; height: 2px; background: #d1d5db; border-radius: 1px;" />
          <div style="width: 16px; height: 2px; background: #d1d5db; border-radius: 1px;" />
          <div style="width: 16px; height: 2px; background: #d1d5db; border-radius: 1px;" />
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 14px; font-weight: 600; color: #1f2937;">VideoMark</span>
          <span v-if="timestamp" style="font-size: 12px; color: #6b7280; font-family: monospace;">{{ timestamp }}</span>
        </div>
      </div>

      <button
        style="
          padding: 4px;
          color: #9ca3af;
          background: none;
          border: none;
          cursor: pointer;
          border-radius: 4px;
          line-height: 1;
        "
        @mouseenter="$event.target.style.color = '#4b5563'"
        @mouseleave="$event.target.style.color = '#9ca3af'"
        @click="onCancel"
      >
        <svg xmlns="http://www.w3.org/2000/svg" style="width: 16px; height: 16px;" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>

    <!-- 内容区域 -->
    <div style="padding: 16px;">
      <textarea
        ref="textareaRef"
        v-model="noteValue"
        style="
          width: 100%;
          min-height: 120px;
          resize: vertical;
          border-radius: 6px;
          border: 1px solid #d1d5db;
          padding: 12px;
          font-size: 14px;
          line-height: 1.5;
          outline: none;
          box-sizing: border-box;
          font-family: inherit;
        "
        placeholder="在这里输入你的备注..."
        @focus="$event.target.style.borderColor = '#3b82f6'; $event.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'"
        @blur="$event.target.style.borderColor = '#d1d5db'; $event.target.style.boxShadow = 'none'"
        @keydown.esc="onCancel"
        @keydown.ctrl.enter="onSave"
        @keydown.meta.enter="onSave"
      />

      <!-- 按钮区域 -->
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
        <button
          style="
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 500;
            color: #4b5563;
            background: none;
            border: none;
            cursor: pointer;
            border-radius: 6px;
            transition: all 0.2s;
          "
          @mouseenter="$event.target.style.background = '#f3f4f6'"
          @mouseleave="$event.target.style.background = 'transparent'"
          @click="onCancel"
        >
          取消
        </button>
        <button
          style="
            padding: 6px 16px;
            font-size: 12px;
            font-weight: 500;
            color: white;
            background: #2563eb;
            border: none;
            cursor: pointer;
            border-radius: 6px;
            transition: all 0.2s;
          "
          @mouseenter="$event.target.style.background = '#1d4ed8'"
          @mouseleave="$event.target.style.background = '#2563eb'"
          @click="onSave"
        >
          保存
        </button>
      </div>
    </div>
  </div>
</template>
