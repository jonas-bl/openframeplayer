import type { CapturedFrame } from '@shared/ipc'

/** A captured video frame: top-down BGRA pixels (`data` length = `w*h*4`). */
export type Frame = CapturedFrame

/** A tracked region, normalised to the frame: top-left `x,y` + size `w,h`, all [0,1]. */
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** A single-object tracker: seed with `init`, then feed frames to `update`. */
export interface Tracker {
  /** Seed the tracker with the subject's region in the given frame. */
  init(frame: Frame, box: Box): void
  /** Advance with a new frame; returns the new region or null if lost. */
  update(frame: Frame): Box | null
  dispose(): void
}

/** Luma at a normalised point (nearest pixel) from a BGRA frame. */
export function grayAt(frame: Frame, nx: number, ny: number): number {
  const px = Math.min(frame.w - 1, Math.max(0, Math.round(nx * (frame.w - 1))))
  const py = Math.min(frame.h - 1, Math.max(0, Math.round(ny * (frame.h - 1))))
  const i = (py * frame.w + px) * 4
  // BGRA → Rec.601 luma.
  return frame.data[i + 2] * 0.299 + frame.data[i + 1] * 0.587 + frame.data[i] * 0.114
}

/** The centre of a box. */
export function boxCenter(b: Box): { x: number; y: number } {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
}

/** Clamps a box's top-left so it stays fully inside the [0,1] frame. */
export function clampBox(b: Box): Box {
  return {
    w: b.w,
    h: b.h,
    x: Math.min(1 - b.w, Math.max(0, b.x)),
    y: Math.min(1 - b.h, Math.max(0, b.y))
  }
}
