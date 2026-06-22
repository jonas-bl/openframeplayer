import { describe, it, expect } from 'vitest'
import { mergeSettings, DEFAULT_SETTINGS } from './settings'

describe('mergeSettings', () => {
  it('returns defaults for null/undefined', () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
  })

  it('overlays partial keybindings onto defaults', () => {
    const merged = mergeSettings({ keybindings: { playPause: ['k'] } as never })
    expect(merged.keybindings.playPause).toEqual(['k'])
    // untouched bindings keep their defaults
    expect(merged.keybindings.frameForward).toEqual(DEFAULT_SETTINGS.keybindings.frameForward)
  })

  it('supports multiple bindings per command', () => {
    const merged = mergeSettings({ keybindings: { zoomIn: ['WheelUp', '+', 'PageUp'] } as never })
    expect(merged.keybindings.zoomIn).toEqual(['WheelUp', '+', 'PageUp'])
  })

  it('wraps a legacy single-string binding into an array', () => {
    const merged = mergeSettings({ keybindings: { playPause: 'k' } as never })
    expect(merged.keybindings.playPause).toEqual(['k'])
  })

  it('does not mutate DEFAULT_SETTINGS', () => {
    const merged = mergeSettings({ keybindings: { playPause: ['x'] } as never })
    merged.keybindings.playPause.push('y')
    expect(DEFAULT_SETTINGS.keybindings.playPause).toEqual([' '])
  })
})
