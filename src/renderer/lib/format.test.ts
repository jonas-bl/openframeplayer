import { describe, it, expect } from 'vitest'
import { formatTimecode, formatFrameCounter } from './format'

describe('formatTimecode', () => {
  it('formats sub-hour durations as M:SS', () => {
    expect(formatTimecode(0)).toBe('0:00')
    expect(formatTimecode(5)).toBe('0:05')
    expect(formatTimecode(75)).toBe('1:15')
    expect(formatTimecode(599)).toBe('9:59')
  })

  it('formats durations past an hour as H:MM:SS', () => {
    expect(formatTimecode(3600)).toBe('1:00:00')
    expect(formatTimecode(3661)).toBe('1:01:01')
  })

  it('clamps invalid input to 0:00', () => {
    expect(formatTimecode(-3)).toBe('0:00')
    expect(formatTimecode(NaN)).toBe('0:00')
  })
})

describe('formatFrameCounter', () => {
  it('shows current / total when total is known', () => {
    expect(formatFrameCounter(84, 1500)).toBe('84 / 1500')
  })

  it('shows just the current frame when total is unknown', () => {
    expect(formatFrameCounter(84, 0)).toBe('84')
    expect(formatFrameCounter(84, NaN)).toBe('84')
  })

  it('rounds and floors negatives', () => {
    expect(formatFrameCounter(83.6, 100)).toBe('84 / 100')
    expect(formatFrameCounter(-2, 100)).toBe('0 / 100')
  })
})
