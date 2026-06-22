import { describe, it, expect } from 'vitest'
import {
  isCompleteAbLoop,
  buildProxyEncodeArgs,
  remapObservedToOriginal,
  remapSeekSecondsToProxy,
  planProxySeek,
  proxyReverseBounds,
  planReverseWindow,
  type ProxySession
} from './loopProxy'

const session: ProxySession = {
  proxyPath: 'C:\\tmp\\proxy.mkv',
  originalPath: 'C:\\v\\clip.mp4',
  startSeconds: 10,
  endSeconds: 14,
  startFrame: 250,
  originalDurationSeconds: 120,
  originalFrameCount: 3000
}

describe('isCompleteAbLoop', () => {
  it('accepts a complete, non-empty A-B range', () => {
    expect(isCompleteAbLoop({ mode: 'ab', start: 3, end: 7 })).toBe(true)
  })
  it('rejects half-marked, inverted, empty, and non-ab loops', () => {
    expect(isCompleteAbLoop({ mode: 'ab', start: 3, end: null })).toBe(false)
    expect(isCompleteAbLoop({ mode: 'ab', start: null, end: 7 })).toBe(false)
    expect(isCompleteAbLoop({ mode: 'ab', start: 7, end: 3 })).toBe(false)
    expect(isCompleteAbLoop({ mode: 'ab', start: 5, end: 5 })).toBe(false)
    expect(isCompleteAbLoop({ mode: 'file', start: 3, end: 7 })).toBe(false)
    expect(isCompleteAbLoop({ mode: 'off', start: 3, end: 7 })).toBe(false)
  })
})

describe('buildProxyEncodeArgs', () => {
  it('encodes only the segment as an all-intra (g=1) clip to the output path', () => {
    const args = buildProxyEncodeArgs({
      inputPath: 'C:\\v\\clip.mp4',
      outputPath: 'C:\\tmp\\proxy.mkv',
      startSeconds: 10,
      endSeconds: 14
    })
    expect(args[0]).toBe('C:\\v\\clip.mp4')
    expect(args).toContain('--start=10')
    expect(args).toContain('--end=14')
    expect(args).toContain('--ovc=libx264')
    expect(args).toContain('--o=C:\\tmp\\proxy.mkv')
    // g=1 is what guarantees every frame is independently decodable.
    expect(args.some((a) => a.includes('g=1'))).toBe(true)
  })
})

describe('remapObservedToOriginal', () => {
  it('offsets time-pos and frame number into original-file terms', () => {
    expect(remapObservedToOriginal('time-pos', 2.5, session)).toEqual({
      name: 'time-pos',
      value: 12.5
    })
    expect(remapObservedToOriginal('estimated-frame-number', 30, session)).toEqual({
      name: 'estimated-frame-number',
      value: 280
    })
  })
  it('reports the original duration, frame count and path, not the proxy values', () => {
    expect(remapObservedToOriginal('duration', 4, session).value).toBe(120)
    expect(remapObservedToOriginal('estimated-frame-count', 100, session).value).toBe(3000)
    expect(remapObservedToOriginal('path', 'C:\\tmp\\proxy.mkv', session).value).toBe(
      'C:\\v\\clip.mp4'
    )
  })
  it('passes unrelated properties through untouched', () => {
    expect(remapObservedToOriginal('pause', true, session)).toEqual({
      name: 'pause',
      value: true
    })
  })
})

describe('remapSeekSecondsToProxy', () => {
  it('subtracts the loop start, clamping outside the region', () => {
    expect(remapSeekSecondsToProxy(12, 10, 14)).toBe(2)
    expect(remapSeekSecondsToProxy(5, 10, 14)).toBe(0) // before A -> start
    expect(remapSeekSecondsToProxy(99, 10, 14)).toBe(4) // after B -> end
  })
})

describe('planProxySeek', () => {
  it('routes a target inside the loop to proxy-relative time', () => {
    expect(planProxySeek(12, 10, 14)).toEqual({ target: 'proxy', seconds: 2 })
  })
  it('includes the exact A and B boundaries in the loop', () => {
    expect(planProxySeek(10, 10, 14)).toEqual({ target: 'proxy', seconds: 0 })
    expect(planProxySeek(14, 10, 14)).toEqual({ target: 'proxy', seconds: 4 })
  })
  it('routes a target outside the loop to the original, unchanged', () => {
    expect(planProxySeek(5, 10, 14)).toEqual({ target: 'original', seconds: 5 })
    expect(planProxySeek(30, 10, 14)).toEqual({ target: 'original', seconds: 30 })
  })
})

describe('proxyReverseBounds', () => {
  it('reverses the whole proxy and wraps at the end', () => {
    expect(proxyReverseBounds(4)).toEqual({ floor: 0, wrapTo: 4 })
  })
  it('stops (no wrap) for a zero-length clip', () => {
    expect(proxyReverseBounds(0)).toEqual({ floor: 0, wrapTo: null })
  })
})

describe('planReverseWindow', () => {
  it('spans the window back from the end point', () => {
    expect(planReverseWindow(100, 20)).toEqual({ startSeconds: 80, endSeconds: 100 })
  })
  it('clamps the start at the floor (file start or A-B in-point)', () => {
    expect(planReverseWindow(15, 20)).toEqual({ startSeconds: 0, endSeconds: 15 })
    expect(planReverseWindow(40, 20, 30)).toEqual({ startSeconds: 30, endSeconds: 40 })
  })
  it('clamps the end up to the floor, yielding an empty window past it', () => {
    expect(planReverseWindow(5, 20, 10)).toEqual({ startSeconds: 10, endSeconds: 10 })
  })
})
