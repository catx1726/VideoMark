<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

interface Props {
  imageSrc: string
  timestamp: string
  note?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

function onClose() {
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown, true)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown, true)
})
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-300 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="props.imageSrc"
      class="fixed inset-0 bg-black/90 flex items-center justify-center z-[99999] p-4"
      @click="onClose"
    >
      <!-- 关闭按钮 -->
      <button
        class="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
        @click.stop="onClose"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <!-- 图片和信息容器 -->
      <div class="flex flex-col items-center gap-4" @click.stop>
        <img
          :src="props.imageSrc"
          class="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
          alt="截图预览"
        >
        <div class="flex flex-col items-center gap-1 text-white/90">
          <span class="text-sm font-mono font-medium">{{ props.timestamp }}</span>
          <span v-if="props.note" class="text-xs text-white/70 max-w-[80vw] text-center line-clamp-3">{{ props.note }}</span>
        </div>
      </div>
    </div>
  </Transition>
</template>
