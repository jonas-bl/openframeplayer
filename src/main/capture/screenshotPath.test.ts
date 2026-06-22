import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { buildScreenshotPath } from './screenshotPath'

const date = new Date(2026, 5, 20, 16, 5, 1) // 2026-06-20 16:05:01 (month is 0-based)

describe('buildScreenshotPath', () => {
  it('combines source basename, frame and timestamp', () => {
    const path = buildScreenshotPath('C:\\shots', 'D:\\clips\\My Clip.mp4', 84, date)
    expect(path).toBe(join('C:\\shots', 'My_Clip_f84_20260620-160501.png'))
  })

  it('falls back to "capture" when no source is loaded', () => {
    const path = buildScreenshotPath('C:\\shots', null, 0, date)
    expect(path).toBe(join('C:\\shots', 'capture_f0_20260620-160501.png'))
  })

  it('sanitises unusual characters in the source name', () => {
    const path = buildScreenshotPath('/out', '/v/oh no?.mkv', 12, date)
    expect(path).toBe(join('/out', 'oh_no__f12_20260620-160501.png'))
  })

  it('rounds and floors negative frame numbers to zero', () => {
    const path = buildScreenshotPath('/out', '/v/a.mp4', -3, date)
    expect(path).toContain('_f0_')
  })
})
