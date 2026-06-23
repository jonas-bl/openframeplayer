import { create } from 'zustand'

/**
 * Renderer-only UI state (not persisted, not shared with mpv): which panels are
 * open and the current fullscreen state mirrored from the main process.
 */
interface UiStore {
  settingsOpen: boolean
  fullscreen: boolean
  /** Whether the pop-out controls window is open (mirrored from main). */
  popoutOpen: boolean
  /** Whether the pop-out analysis-panels window is open (mirrored from main). */
  panelPopoutOpen: boolean
  /** Whether this window's transport is linked to its comparison peers. */
  comparisonLinked: boolean
  /** Whether this window is pinned always-on-top (mirrored from main). */
  alwaysOnTop: boolean
  /** When true, the feature tour is forced open (e.g. re-launched from the idle screen). */
  introRequested: boolean

  openSettings: () => void
  closeSettings: () => void
  setFullscreen: (fullscreen: boolean) => void
  setPopoutOpen: (open: boolean) => void
  setPanelPopoutOpen: (open: boolean) => void
  setComparisonLinked: (linked: boolean) => void
  setAlwaysOnTop: (onTop: boolean) => void
  /** Force the feature tour to open. */
  requestIntro: () => void
  /** Clear a pending forced-tour request. */
  clearIntroRequest: () => void
}

export const useUiStore = create<UiStore>((set) => ({
  settingsOpen: false,
  fullscreen: false,
  popoutOpen: false,
  panelPopoutOpen: false,
  comparisonLinked: false,
  alwaysOnTop: false,
  introRequested: false,

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  setFullscreen: (fullscreen) => set({ fullscreen }),
  setPopoutOpen: (open) => set({ popoutOpen: open }),
  setPanelPopoutOpen: (open) => set({ panelPopoutOpen: open }),
  setComparisonLinked: (linked) => set({ comparisonLinked: linked }),
  setAlwaysOnTop: (onTop) => set({ alwaysOnTop: onTop }),
  requestIntro: () => set({ introRequested: true }),
  clearIntroRequest: () => set({ introRequested: false })
}))
