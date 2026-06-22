import { describe, it, expect } from 'vitest'
import { parseBinding, makeBinding, formatBinding } from './commands'

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
