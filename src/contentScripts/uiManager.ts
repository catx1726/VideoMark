import { createApp, h, onMounted, ref } from 'vue'
import type { App } from 'vue'
import VideoMarkNotePopup from './views/VideoMarkNotePopup.vue'
import ScreenshotPreview from './views/ScreenshotPreview.vue'
import type { Mark } from '~/logic/storage'

const NOTE_CONTAINER_ID = 'videomark-note-popup-container'
const SCREENSHOT_CONTAINER_ID = 'videomark-screenshot-preview-container'

let noteApp: App | null = null
let noteContainer: HTMLElement | null = null
let screenshotApp: App | null = null
let screenshotContainer: HTMLElement | null = null

function ensureContainer(id: string): HTMLElement {
  let container = document.getElementById(id)
  if (!container) {
    container = document.createElement('div')
    container.id = id
    document.body.appendChild(container)
  }
  return container
}

function removeContainer(id: string) {
  const container = document.getElementById(id)
  if (container && container.parentNode) {
    container.parentNode.removeChild(container)
  }
}

export function showNotePopup(mark: Mark, onSave: (note: string) => void) {
  hideNotePopup()

  noteContainer = ensureContainer(NOTE_CONTAINER_ID)

  noteApp = createApp({
    setup() {
      const popupRef = ref<InstanceType<typeof VideoMarkNotePopup> | null>(null)

      onMounted(() => {
        popupRef.value?.show(mark.text)
      })

      return () => h(VideoMarkNotePopup, {
        ref: popupRef,
        onSave: (note: string) => {
          onSave(note)
          hideNotePopup()
        },
        onCancel: () => hideNotePopup(),
      })
    },
  })

  noteApp.mount(noteContainer)
}

export function hideNotePopup() {
  if (noteApp) {
    noteApp.unmount()
    noteApp = null
  }
  removeContainer(NOTE_CONTAINER_ID)
  noteContainer = null
}

export function showScreenshotPreview(mark: Mark) {
  hideScreenshotPreview()

  if (!mark.screenshot)
    return

  screenshotContainer = ensureContainer(SCREENSHOT_CONTAINER_ID)

  screenshotApp = createApp({
    setup() {
      return () => h(ScreenshotPreview, {
        imageSrc: mark.screenshot,
        timestamp: mark.text,
        note: mark.note,
        onClose: () => hideScreenshotPreview(),
      })
    },
  })

  screenshotApp.mount(screenshotContainer)
}

export function hideScreenshotPreview() {
  if (screenshotApp) {
    screenshotApp.unmount()
    screenshotApp = null
  }
  removeContainer(SCREENSHOT_CONTAINER_ID)
  screenshotContainer = null
}
