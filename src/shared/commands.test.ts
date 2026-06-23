import { describe, it, expect } from 'vitest'
import {
  parseBinding,
  makeBinding,
  formatBinding,
  canonicalBinding,
  findBindingConflicts,
  DEFAULT_KEYBINDINGS
} from './commands'

describe('binding parsing', () => {
  it('parses a plain key as having no modifier', () => {
    expect(parseBinding('s')).toEqual({ modifier: null, key: 's' })
    expect(parseBinding('ArrowLeft')).toEqual({ modifier: null, key: 'ArrowLeft' })
  })

  it('splits a leading Ctrl/Alt modifier from the key', () => {
    expect(parseBinding('Ctrl+WheelUp')).toEqual({ modifier: 'Ctrl', key: 'WheelUp' })
    expect(parseBinding('Alt+0')).toEqual({ modifier: 'Alt', key: '0' })
  })

  it('keeps a literal "+" key when it is the bound key', () => {
    expect(parseBinding('+')).toEqual({ modifier: null, key: '+' })
    expect(parseBinding('Ctrl++')).toEqual({ modifier: 'Ctrl', key: '+' })
  })

  it('round-trips through makeBinding', () => {
    expect(makeBinding('Ctrl', 'WheelUp')).toBe('Ctrl+WheelUp')
    expect(makeBinding(null, '+')).toBe('+')
    expect(parseBinding(makeBinding('Alt', 'k'))).toEqual({ modifier: 'Alt', key: 'k' })
  })

  it('formats bindings for display', () => {
    expect(formatBinding('Ctrl+WheelUp')).toBe('Ctrl + Scroll ↑')
    expect(formatBinding(' ')).toBe('Space')
    expect(formatBinding('Alt+ArrowDown')).toBe('Alt + ↓')
  })
})

describe('canonicalBinding', () => {
  it('folds equivalent chords to one form (case + "=" / "+")', () => {
    expect(canonicalBinding('S')).toBe(canonicalBinding('s'))
    expect(canonicalBinding('=')).toBe(canonicalBinding('+'))
    expect(canonicalBinding('Ctrl+S')).toBe(canonicalBinding('Ctrl+s'))
  })

  it('keeps a modifier as part of the chord', () => {
    expect(canonicalBinding('Ctrl+s')).not.toBe(canonicalBinding('s'))
  })
})

describe('findBindingConflicts', () => {
  it('reports no conflicts for the defaults', () => {
    for (const command of Object.keys(DEFAULT_KEYBINDINGS)) {
      for (const binding of DEFAULT_KEYBINDINGS[command as keyof typeof DEFAULT_KEYBINDINGS]) {
        expect(findBindingConflicts(DEFAULT_KEYBINDINGS, binding, command as never)).toEqual([])
      }
    }
  })

  it('finds another command bound to the same chord', () => {
    // "s" is screenshotEditor by default; binding it to flipHorizontal clashes.
    expect(findBindingConflicts(DEFAULT_KEYBINDINGS, 's', 'flipHorizontal')).toEqual([
      'screenshotEditor'
    ])
  })

  it('matches across key-folding (case and "=" / "+")', () => {
    expect(findBindingConflicts(DEFAULT_KEYBINDINGS, 'S', 'flipHorizontal')).toEqual([
      'screenshotEditor'
    ])
    expect(findBindingConflicts(DEFAULT_KEYBINDINGS, '=', 'frameForward')).toEqual(['zoomIn'])
  })

  it('excludes the command being edited and distinguishes modifiers', () => {
    expect(findBindingConflicts(DEFAULT_KEYBINDINGS, ' ', 'playPause')).toEqual([])
    // Ctrl+s (screenshot) does not clash with plain s (screenshotEditor).
    expect(findBindingConflicts(DEFAULT_KEYBINDINGS, 'Ctrl+s', 'flipHorizontal')).toEqual([
      'screenshot'
    ])
  })
})
