import { describe, expect, it, vi } from 'vitest'

// Mock settings，阻断 webextension-polyfill 在测试环境加载
vi.mock('~/logic/settings', () => ({
  settings: { value: { theme: 'auto' } },
  defaultSettings: {},
}))

import { resolveTheme } from '~/logic/theme'

describe('resolveTheme', () => {
  it('auto 跟随系统', () => {
    expect(resolveTheme('auto', true)).toBe(true)
    expect(resolveTheme('auto', false)).toBe(false)
  })

  it('手动覆盖系统设置', () => {
    expect(resolveTheme('dark', false)).toBe(true)
    expect(resolveTheme('light', true)).toBe(false)
  })

  it('非法/缺失偏好回退 auto 行为（跟随系统）', () => {
    expect(resolveTheme(undefined as any, true)).toBe(true)
    expect(resolveTheme(undefined as any, false)).toBe(false)
  })
})
