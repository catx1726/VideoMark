<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const props = defineProps<{
  imageSrc: string
  timestamp: string
  note?: string
}>()

const visible = ref(false)

function close() {
  visible.value = false
  setTimeout(() => {
    emit('close')
  }, 200)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  requestAnimationFrame(() => {
    visible.value = true
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div
    style="
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      opacity: 0;
      transition: opacity 0.2s ease;
    "
    :style="{ opacity: visible ? 1 : 0 }"
    @click="close"
  >
    <div
      style="
        position: relative;
        max-width: 90vw;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        align-items: center;
      "
      @click.stop
    >
      <!-- 关闭按钮 -->
      <button
        style="
          position: absolute;
          top: -40px;
          right: 0;
          color: rgba(255, 255, 255, 0.8);
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          line-height: 1;
        "
        @mouseenter="$event.target.style.color = 'white'"
        @mouseleave="$event.target.style.color = 'rgba(255, 255, 255, 0.8)'"
        @click="close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" style="width: 32px; height: 32px;" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>

      <!-- 图片 -->
      <img
        :src="props.imageSrc"
        style="
          max-width: 100%;
          max-height: 80vh;
          object-fit: contain;
          border-radius: 8px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        "
        alt="视频截图预览"
      >

      <!-- 信息区域 -->
      <div style="margin-top: 16px; text-align: center;">
        <p style="color: white; font-weight: 500; font-size: 18px; margin: 0;">{{ props.timestamp }}</p>
        <p v-if="props.note" style="color: rgba(255, 255, 255, 0.7); font-size: 14px; margin-top: 4px; max-width: 400px;">{{ props.note }}</p>
      </div>
    </div>
  </div>
</template>
