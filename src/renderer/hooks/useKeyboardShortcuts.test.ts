import { describe, it, expect } from 'vitest'
import { matchCommand, type InputChord } from './useKeyboardShortcuts'
import { DEFAULT_KEYBINDINGS } from '@shared/commands'

const kb = DEFAULT_KEYBINDINGS
const k = (key: string, modifier: InputChord['modifier'] = null): InputChord => ({ key, modifier })

describe('matchCommand', () => {
  it('matches the default bindings', () => {
    expect(matchCommand(k('ArrowLeft'), kb)).toBe('frameBack')
    expect(matchCommand(k('ArrowRight'), kb)).toBe('frameForward')
    expect(matchCommand(k(' '), kb)).toBe('playPause')
    expect(matchCommand(k('s'), kb)).toBe('screenshotEditor')
    expect(matchCommand(k('s', 'Ctrl'), kb)).toBe('screenshot')
    expect(matchCommand(k('f'), kb)).toBe('flipHorizontal')
    expect(matchCommand(k('r'), kb)).toBe('resetImage')
    expect(matchCommand(k('d'), kb)).toBe('resetView')
    expect(matchCommand(k('i'), kb)).toBe('toggleImagePanel')
    expect(matchCommand(k('p'), kb)).toBe('popoutControls')
    expect(matchCommand(k('F11'), kb)).toBe('toggleFullscreen')
  })

  it('is case-insensitive for letters', () => {
    expect(matchCommand(k('S'), kb)).toBe('screenshotEditor')
    expect(matchCommand(k('F'), kb)).toBe('flipHorizontal')
  })

  it('treats "=" as "+" for zoom in', () => {
    expect(matchCommand(k('+'), kb)).toBe('zoomIn')
    expect(matchCommand(k('='), kb)).toBe('zoomIn')
    expect(matchCommand(k('-'), kb)).toBe('zoomOut')
  })

  it('matches any of a command’s bindings (zoom via key or plain wheel)', () => {
    // zoomIn is bound to both WheelUp and "+" by default
    expect(matchCommand(k('WheelUp'), kb)).toBe('zoomIn')
    expect(matchCommand(k('+'), kb)).toBe('zoomIn')
    expect(matchCommand(k('WheelDown'), kb)).toBe('zoomOut')
    expect(matchCommand(k('-'), kb)).toBe('zoomOut')
  })

  it('matches modifier chords and wheel tokens (speed via Ctrl+scroll)', () => {
    expect(matchCommand(k('WheelUp', 'Ctrl'), kb)).toBe('speedUp')
    expect(matchCommand(k('WheelDown', 'Ctrl'), kb)).toBe('speedDown')
    expect(matchCommand(k('0', 'Ctrl'), kb)).toBe('speedReset')
  })

  it('distinguishes a chord from the same key without its modifier', () => {
    // Ctrl+WheelUp is speed; a plain WheelUp is the (separate) zoom binding
    expect(matchCommand(k('WheelUp'), kb)).toBe('zoomIn')
    expect(matchCommand(k('0'), kb)).toBeNull()
    // a plain key must not match when an unexpected modifier is held
    expect(matchCommand(k('f', 'Ctrl'), kb)).toBeNull()
  })

  it('returns null for unbound keys', () => {
    expect(matchCommand(k('x'), kb)).toBeNull()
    expect(matchCommand(k('Enter'), kb)).toBeNull()
  })

  it('respects custom bindings', () => {
    const custom = { ...kb, playPause: ['k'] }
    expect(matchCommand(k('k'), custom)).toBe('playPause')
    expect(matchCommand(k(' '), custom)).toBeNull()
  })
})
