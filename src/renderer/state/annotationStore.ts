import { create } from 'zustand'
import type { Vec2 } from '../lib/videoTransform'
import {
  DEFAULT_ANNOTATION_CONTROL,
  type Anchor,
  type AnnotationControl,
  type DrawTool,
  type ToolMode
} from '@shared/annotation'

export type { Anchor, DrawTool, ToolMode } from '@shared/annotation'

export interface Annotation {
  id: string
  tool: DrawTool
  color: string
  /** Stroke width in screen px (constant regardless of zoom). */
  width: number
  /** Geometry in content space (see videoTransform): pen = path, others = 2 pts. */
  points: Vec2[]
  /** `steady` glues to the frame; `follow` tracks a moving subject (Phase 2). */
  anchor: Anchor
}

/** Default colour swatches for the drawing palette. */
export const DRAW_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ffffff']

let nextId = 1
const makeId = (): string => `a${nextId++}`

interface AnnotationStore {
  toolMode: ToolMode
  tool: DrawTool
  color: string
  strokeWidth: number
  /** Anchor applied to newly drawn annotations (`steady` or `follow`). */
  drawAnchor: Anchor
  annotations: Annotation[]
  /** When true, the autofocus target is kept centred frame-to-frame. */
  keepCentered: boolean
  /** Content-space point the continuous autofocus is tracking, if any. */
  focusPoint: Vec2 | null

  setToolMode: (mode: ToolMode) => void
  /** Flip a tool mode on, or back to `none` if it's already active (toggle). */
  toggleToolMode: (mode: Exclude<ToolMode, 'none'>) => void
  setTool: (tool: DrawTool) => void
  setColor: (color: string) => void
  setStrokeWidth: (width: number) => void
  setDrawAnchor: (anchor: Anchor) => void
  /** Apply a synced control patch from another window in the group (no echo). */
  applyControl: (patch: Partial<AnnotationControl>) => void
  addAnnotation: (a: Omit<Annotation, 'id'>) => void
  /** Translate an annotation's geometry by a content-space delta (tracking). */
  moveAnnotation: (id: string, dx: number, dy: number) => void
  undo: () => void
  clear: () => void
  toggleKeepCentered: () => void
  setFocusPoint: (point: Vec2 | null) => void
}

/**
 * Renderer-only state for the annotation/autofocus tools. Kept separate from
 * `uiStore` so the video gesture layer stays decoupled from drawing concerns.
 */
export const useAnnotationStore = create<AnnotationStore>((set) => ({
  ...DEFAULT_ANNOTATION_CONTROL,
  annotations: [],
  focusPoint: null,

  setToolMode: (toolMode) => set({ toolMode }),
  toggleToolMode: (mode) => set((s) => ({ toolMode: s.toolMode === mode ? 'none' : mode })),
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setDrawAnchor: (drawAnchor) => set({ drawAnchor }),
  applyControl: (patch) =>
    set((s) => ({
      ...patch,
      // Turning keep-centred off elsewhere should drop our local focus point too.
      focusPoint: patch.keepCentered === false ? null : s.focusPoint
    })),
  addAnnotation: (a) => set((s) => ({ annotations: [...s.annotations, { ...a, id: makeId() }] })),
  moveAnnotation: (id, dx, dy) =>
    set((s) => ({
      annotations: s.annotations.map((a) =>
        a.id === id
          ? { ...a, points: a.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
          : a
      )
    })),
  undo: () => set((s) => ({ annotations: s.annotations.slice(0, -1) })),
  clear: () => set({ annotations: [], focusPoint: null }),
  toggleKeepCentered: () =>
    set((s) => {
      const keepCentered = !s.keepCentered
      return { keepCentered, focusPoint: keepCentered ? s.focusPoint : null }
    }),
  setFocusPoint: (focusPoint) => set({ focusPoint })
}))
