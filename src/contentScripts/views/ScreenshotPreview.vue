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
    class="fixed inset-0 z-[99999] bg-black/90 flex items-center justify-center p-4 transition-opacity duration-200"
    :class="visible ? 'opacity-100' : 'opacity-0'"
    @click="close"
  >
    <div class="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center" @click.stop>
      <!-- 关闭按钮 -->
      <button
        class="absolute -top-10 right-0 text-white/80 hover:text-white transition-colors"
        @click="close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>
      
      <!-- 图片 -->
      <img
        :src="props.imageSrc"
        class="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
        alt="视频截图预览"
      >
      
      <!-- 信息区域 -->
      <div class="mt-4 text-center">
        <p class="text-white font-medium text-lg">{{ props.timestamp }}</p>
        <p v-if="props.note" class="text-white/70 text-sm mt-1 max-w-md">{{ props.note }}</p>
      </div>
    </div>
  </div>
</template>
