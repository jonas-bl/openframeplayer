import { clampBox, type Box, type Frame, type Tracker } from '../types'

/**
 * OpenCV.js region tracker (CSRT, falling back to KCF). Robust, region-based —
 * follows any drawn box without needing a model. The wasm build is large
 * (~11 MB) so it is loaded lazily on first use; if this OpenCV build wasn't
 * compiled with the tracking module, `create()` throws and the caller falls
 * back to the built-in tracker.
 */

// opencv.js has no bundled types; treat it loosely.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Cv = any

let cvPromise: Promise<Cv> | null = null

/** Loads opencv.js once and resolves when its runtime is initialised. */
async function loadCv(): Promise<Cv> {
  if (!cvPromise) {
    cvPromise = import('@techstark/opencv-js').then(
      (m) =>
        new Promise<Cv>((resolve) => {
          const cv = (m.default ?? m) as Cv
          if (cv && cv.Mat) resolve(cv)
          else cv.onRuntimeInitialized = () => resolve(cv)
        })
    )
  }
  return cvPromise
}

/** Builds a CSRT (or KCF) tracker instance, or throws if unavailable. */
function newTracker(cv: Cv): { obj: Cv; isLegacy: boolean } {
  if (typeof cv.TrackerCSRT?.create === 'function') return { obj: cv.TrackerCSRT.create(), isLegacy: false }
  if (typeof cv.legacy_TrackerCSRT?.create === 'function')
    return { obj: cv.legacy_TrackerCSRT.create(), isLegacy: true }
  if (typeof cv.TrackerKCF?.create === 'function') return { obj: cv.TrackerKCF.create(), isLegacy: false }
  throw new Error('OpenCV build has no CSRT/KCF tracker')
}

class OpenCvTracker implements Tracker {
  private mat: Cv | null = null
  private box: Box = { x: 0, y: 0, w: 0.1, h: 0.1 }

  constructor(
    private readonly cv: Cv,
    private tracker: Cv
  ) {}

  init(frame: Frame, box: Box): void {
    this.box = clampBox(box)
    const mat = this.toMat(frame)
    const rect = this.toRect(frame, this.box)
    this.tracker.init(mat, rect)
    rect.delete?.()
  }

  update(frame: Frame): Box | null {
    const mat = this.toMat(frame)
    const rect = new this.cv.Rect()
    const ok = this.tracker.update(mat, rect)
    if (!ok) return null
    this.box = clampBox({
      x: rect.x / frame.w,
      y: rect.y / frame.h,
      w: rect.width / frame.w,
      h: rect.height / frame.h
    })
    return { ...this.box }
  }

  dispose(): void {
    this.mat?.delete?.()
    this.mat = null
    this.tracker?.delete?.()
  }

  /** Reuses one RGBA Mat, refilled from the BGRA frame each call. */
  private toMat(frame: Frame): Cv {
    if (!this.mat || this.mat.cols !== frame.w || this.mat.rows !== frame.h) {
      this.mat?.delete?.()
      this.mat = new this.cv.Mat(frame.h, frame.w, this.cv.CV_8UC4)
    }
    this.mat.data.set(frame.data) // BGRA; CSRT works fine on the raw channels
    return this.mat
  }

  private toRect(frame: Frame, b: Box): Cv {
    return new this.cv.Rect(
      Math.round(b.x * frame.w),
      Math.round(b.y * frame.h),
      Math.max(1, Math.round(b.w * frame.w)),
      Math.max(1, Math.round(b.h * frame.h))
    )
  }
}

/** Creates an OpenCV tracker, or throws (caller falls back to built-in). */
export async function createOpenCvTracker(): Promise<Tracker> {
  const cv = await loadCv()
  const { obj } = newTracker(cv)
  return new OpenCvTracker(cv, obj)
}
