import { clampBox, grayAt, type Box, type Frame, type Tracker } from '../types'

/**
 * Dependency-free template tracker via normalised cross-correlation (NCC).
 *
 * On `init` it samples a small fixed grid of the subject's luma into a
 * zero-mean template. Each `update` searches a window of candidate offsets for
 * the position whose patch best correlates with the template (illumination- and
 * contrast-invariant thanks to NCC), then recentres. The template adapts slowly
 * to drift. Everything is in normalised frame coordinates, so it tolerates the
 * frame being downscaled or its size changing between calls.
 *
 * It's intentionally light (default engine, and the universal fallback when a
 * heavier engine can't load); good for steady-ish subjects, not occlusion.
 */

const GRID = 20 // template is GRID×GRID samples
const SEARCH = 0.1 // search radius, fraction of the frame
const STEP = 0.012 // candidate spacing
const ADAPT = 0.1 // template learning rate per frame

export class BuiltinTracker implements Tracker {
  private tpl = new Float32Array(GRID * GRID) // zero-mean template
  private tplNorm = 1
  private box: Box = { x: 0, y: 0, w: 0.1, h: 0.1 }

  init(frame: Frame, box: Box): void {
    this.box = clampBox(box)
    this.sampleTemplate(frame, this.box)
  }

  update(frame: Frame): Box | null {
    let best = -Infinity
    let bx = this.box.x
    let by = this.box.y
    for (let dy = -SEARCH; dy <= SEARCH; dy += STEP) {
      for (let dx = -SEARCH; dx <= SEARCH; dx += STEP) {
        const cand = clampBox({ ...this.box, x: this.box.x + dx, y: this.box.y + dy })
        const score = this.score(frame, cand)
        if (score > best) {
          best = score
          bx = cand.x
          by = cand.y
        }
      }
    }
    this.box = { ...this.box, x: bx, y: by }
    this.adapt(frame, this.box)
    return { ...this.box }
  }

  dispose(): void {
    /* nothing to release */
  }

  /** Fills the template (zero-mean) from the box region and records its norm. */
  private sampleTemplate(frame: Frame, box: Box): void {
    let sum = 0
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const v = grayAt(frame, box.x + ((i + 0.5) / GRID) * box.w, box.y + ((j + 0.5) / GRID) * box.h)
        this.tpl[j * GRID + i] = v
        sum += v
      }
    }
    const mean = sum / this.tpl.length
    let ss = 0
    for (let k = 0; k < this.tpl.length; k++) {
      this.tpl[k] -= mean
      ss += this.tpl[k] * this.tpl[k]
    }
    this.tplNorm = Math.sqrt(ss) || 1
  }

  /** NCC of the candidate patch against the stored template. */
  private score(frame: Frame, box: Box): number {
    let sum = 0
    const patch = scratch
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const v = grayAt(frame, box.x + ((i + 0.5) / GRID) * box.w, box.y + ((j + 0.5) / GRID) * box.h)
        patch[j * GRID + i] = v
        sum += v
      }
    }
    const mean = sum / patch.length
    let dot = 0
    let ss = 0
    for (let k = 0; k < patch.length; k++) {
      const d = patch[k] - mean
      dot += d * this.tpl[k]
      ss += d * d
    }
    return dot / (this.tplNorm * (Math.sqrt(ss) || 1))
  }

  /** Blends the current patch into the template to follow gradual change. */
  private adapt(frame: Frame, box: Box): void {
    let sum = 0
    const patch = scratch
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const v = grayAt(frame, box.x + ((i + 0.5) / GRID) * box.w, box.y + ((j + 0.5) / GRID) * box.h)
        patch[j * GRID + i] = v
        sum += v
      }
    }
    const mean = sum / patch.length
    let ss = 0
    for (let k = 0; k < patch.length; k++) {
      const d = patch[k] - mean
      this.tpl[k] = (1 - ADAPT) * this.tpl[k] + ADAPT * d
      ss += this.tpl[k] * this.tpl[k]
    }
    this.tplNorm = Math.sqrt(ss) || 1
  }
}

/** Shared scratch buffer (single-threaded; one tracker steps at a time per rAF). */
const scratch = new Float32Array(GRID * GRID)
