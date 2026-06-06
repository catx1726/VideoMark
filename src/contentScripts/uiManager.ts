import { createApp, h, onMounted, ref } from 'vue'
import type { App } from 'vue'
import VideoMarkNotePopup from './views/VideoMarkNotePopup.vue'
import ScreenshotPreview from './views/ScreenshotPreview.vue'
import type { Mark } from '~/logic/storage'
import { ShadowDOMManager } from '~/logic/shadowDom'
import { getMaxZIndex } from '~/logic/dom'
import browser from 'webextension-polyfill'

const NOTE_CONTAINER_ID = 'videomark-note-popup-container'
const SCREENSHOT_CONTAINER_ID = 'videomark-screenshot-preview-container'

let noteApp: App | null = null
let noteContainer: HTMLDivElement | null = null
let screenshotApp: App | null = null
let screenshotContainer: HTMLDivElement | null = null

function createShadowContainer(id: string): HTMLDivElement {
  const container = ShadowDOMManager.createContainer(id, getMaxZIndex() + 100)
  document.body.appendChild(container)
  
  const shadowRoot = container.attachShadow({ mode: 'open' })
  ShadowDOMManager.attachStylesheet(shadowRoot, browser.runtime.getURL('dist/contentScripts/style.css'))
  
  const uiRoot = document.createElement('div')
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (isDark)
    uiRoot.classList.add('dark')
  shadowRoot.appendChild(uiRoot)
  
  return uiRoot
}

function removeShadowContainer(id: string) {
  const container = document.getElementById(id)
  if (container && container.parentNode) {
    container.parentNode.removeChild(container)
  }
}

export function showNotePopup(mark: Mark, onSave: (note: string) => void) {
  hideNotePopup()

  noteContainer = createShadowContainer(NOTE_CONTAINER_ID)

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
  removeShadowContainer(NOTE_CONTAINER_ID)
  noteContainer = null
}

export function showScreenshotPreview(mark: Mark) {
  hideScreenshotPreview()

  if (!mark.screenshot)
    return

  screenshotContainer = createShadowContainer(SCREENSHOT_CONTAINER_ID)

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
  removeShadowContainer(SCREENSHOT_CONTAINER_ID)
  screenshotContainer = null
}
