import { describe, it, expect } from 'vitest'
import { resizeRect, type Rect } from './resizeRect'

const start: Rect = { x: 100, y: 100, width: 800, height: 600 }
const min = { width: 400, height: 300 }

describe('resizeRect', () => {
  it('grows from the east edge without moving the origin', () => {
    expect(resizeRect(start, 'e', 50, 0, min)).toEqual({ x: 100, y: 100, width: 850, height: 600 })
  })

  it('grows from the south edge', () => {
    expect(resizeRect(start, 's', 0, 40, min)).toEqual({ x: 100, y: 100, width: 800, height: 640 })
  })

  it('moves the origin when dragging the west edge', () => {
    expect(resizeRect(start, 'w', 30, 0, min)).toEqual({ x: 130, y: 100, width: 770, height: 600 })
  })

  it('moves the origin when dragging the north edge', () => {
    expect(resizeRect(start, 'n', 0, 25, min)).toEqual({ x: 100, y: 125, width: 800, height: 575 })
  })

  it('handles corners (south-east) by combining axes', () => {
    expect(resizeRect(start, 'se', 20, 30, min)).toEqual({ x: 100, y: 100, width: 820, height: 630 })
  })

  it('clamps to min size from the east edge', () => {
    expect(resizeRect(start, 'e', -1000, 0, min)).toEqual({ x: 100, y: 100, width: 400, height: 600 })
  })

  it('clamps to min size from the west edge while keeping the east edge fixed', () => {
    // east edge is at x=900; min width 400 => x should become 500
    const r = resizeRect(start, 'w', 1000, 0, min)
    expect(r.width).toBe(400)
    expect(r.x).toBe(500)
    expect(r.x + r.width).toBe(900)
  })

  it('clamps to min size from the north edge while keeping the south edge fixed', () => {
    // south edge is at y=700; min height 300 => y should become 400
    const r = resizeRect(start, 'n', 0, 1000, min)
    expect(r.height).toBe(300)
    expect(r.y).toBe(400)
    expect(r.y + r.height).toBe(700)
  })
})
