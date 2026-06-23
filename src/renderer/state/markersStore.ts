import { create } from 'zustand'
import type { Marker } from '@shared/fileMetadata'

/** Two markers closer than this (seconds) are treated as the same spot. */
const DEDUP_SECONDS = 0.4

/**
 * Renderer store for the current file's timeline markers (bookmarks). Loaded
 * from and persisted to the main-process {@link FileMetadataStore} per file, so
 * markers survive across sessions. Kept separate from playerStore (which mirrors
 * mpv) because markers are app-owned, per-file data.
 */
interface MarkersStore {
  /** The file these markers belong to (guards stale writes). */
  path: string | null
  markers: Marker[]
  /** Load the markers for `path` (or clear when null). */
  load: (path: string | null) => void
  /** Add a marker at `time` (seconds); no-op if one is already there. */
  add: (time: number) => void
  removeAt: (index: number) => void
}

export const useMarkersStore = create<MarkersStore>((set, get) => ({
  path: null,
  markers: [],

  load: (path) => {
    set({ path, markers: [] })
    if (!path) return
    void window.api.getFileMetadata(path).then((meta) => {
      // Ignore if the file changed again while the fetch was in flight.
      if (get().path === path) set({ markers: meta?.bookmarks ?? [] })
    })
  },

  add: (time) => {
    const { path, markers } = get()
    if (!path) return
    if (markers.some((m) => Math.abs(m.time - time) < DEDUP_SECONDS)) return
    const next = [...markers, { time }].sort((a, b) => a.time - b.time)
    set({ markers: next })
    window.api.saveBookmarks(path, next)
  },

  removeAt: (index) => {
    const { path, markers } = get()
    if (!path) return
    const next = markers.filter((_, i) => i !== index)
    set({ markers: next })
    window.api.saveBookmarks(path, next)
  }
}))

/** The marker immediately after `time`, or null. */
export function nextMarkerTime(markers: Marker[], time: number): number | null {
  const m = markers.find((x) => x.time > time + 0.05)
  return m ? m.time : null
}

/** The marker immediately before `time`, or null. */
export function prevMarkerTime(markers: Marker[], time: number): number | null {
  let found: number | null = null
  for (const x of markers) {
    if (x.time < time - 0.05) found = x.time
    else break
  }
  return found
}
