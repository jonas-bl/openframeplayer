import { describe, it, expect } from 'vitest'
import {
  screenToContentAxis,
  contentToScreenAxis,
  panToCenterAxis,
  screenToContent,
  contentToScreen,
  zoomToFitRegion
} from './videoTransform'

describe('videoTransform axis mapping', () => {
  it('is identity at zoom=0, pan=0 (content == screen)', () => {
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      expect(screenToContentAxis(f, 0, 0)).toBeCloseTo(f)
      expect(contentToScreenAxis(f, 0, 0)).toBeCloseTo(f)
    }
  })

  it('round-trips screen → content → screen under zoom & pan', () => {
    const cases = [
      { f: 0.3, pan: 0.1, zoom: 1 },
      { f: 0.8, pan: -0.2, zoom: -1 },
      { f: 0.5, pan: 0.4, zoom: 2 }
    ]
    for (const { f, pan, zoom } of cases) {
      const n = screenToContentAxis(f, pan, zoom)
      expect(contentToScreenAxis(n, pan, zoom)).toBeCloseTo(f)
    }
  })

  it('panToCenter centres a content point on screen', () => {
    const n = 0.2
    const zoom = 1.5
    const pan = panToCenterAxis(n, zoom)
    expect(contentToScreenAxis(n, pan, zoom)).toBeCloseTo(0.5)
  })

  it('is consistent with the cursor-anchored zoom formula pan\' = o(1-r)+r·pan', () => {
    // Zooming about a cursor must keep the content point under it fixed.
    const pan = 0.15
    const zoom = 0.5
    const f = 0.7 // cursor screen fraction
    const n = screenToContentAxis(f, pan, zoom)

    const dz = 0.3
    const r = Math.pow(2, dz)
    const o = f - 0.5
    const panPrime = o * (1 - r) + r * pan
    // Same content point should still sit under the cursor after the zoom.
    expect(screenToContentAxis(f, panPrime, zoom + dz)).toBeCloseTo(n)
  })
})

describe('zoomToFitRegion', () => {
  it('centres the drawn box and zooms in to contain it', () => {
    const current = { zoom: 0, panX: 0, panY: 0 }
    // A box around screen-centre-ish, 25% wide/tall → ~2x zoom (1/0.25 = 4 → wait)
    const c0 = { x: 0.4, y: 0.4 }
    const c1 = { x: 0.6, y: 0.6 }
    const result = zoomToFitRegion(c0, c1, current)

    // box center (0.5,0.5) is already centre → pan stays ~0
    expect(result.panX).toBeCloseTo(0)
    expect(result.panY).toBeCloseTo(0)
    // 0.2 span → scale 5 → zoom log2(5) ≈ 2.32, capped at 4
    expect(result.zoom).toBeCloseTo(Math.log2(5))

    // After applying, the box corners map to the region edges (contain fit).
    const pan = { x: result.panX, y: result.panY }
    const s0 = contentToScreen(screenToContent(c0, { x: 0, y: 0 }, 0), pan, result.zoom)
    expect(s0.x).toBeCloseTo(0)
    expect(s0.y).toBeCloseTo(0)
  })

  it('caps zoom for tiny boxes', () => {
    const result = zoomToFitRegion({ x: 0.5, y: 0.5 }, { x: 0.5001, y: 0.5001 }, {
      zoom: 0,
      panX: 0,
      panY: 0
    })
    expect(result.zoom).toBeLessThanOrEqual(4)
  })
})
