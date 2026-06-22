import { create } from 'zustand'

/**
 * Renderer-only UI state (not persisted, not shared with mpv): which panels are
 * open and the current fullscreen state mirrored from the main process.
 */
interface UiStore {
  imagePanelVisible: boolean
  settingsOpen: boolean
  fullscreen: boolean
  /** Whether the pop-out controls window is open (mirrored from main). */
  popoutOpen: boolean

  toggleImagePanel: () => void
  /** Mirror the persisted value (seeded/synced from settings). */
  setImagePanelVisible: (visible: boolean) => void
  openSettings: () => void
  closeSettings: () => void
  setFullscreen: (fullscreen: boolean) => void
  setPopoutOpen: (open: boolean) => void
}

export const useUiStore = create<UiStore>((set) => ({
  // Seeded from persisted settings on mount; toggling writes back so the panel
  // stays in the state you left it across videos and sessions.
  imagePanelVisible: false,
  settingsOpen: false,
  fullscreen: false,
  popoutOpen: false,

  toggleImagePanel: () =>
    set((s) => {
      const imagePanelVisible = !s.imagePanelVisible
      void window.api.updateSettings({ imagePanelVisible })
      return { imagePanelVisible }
    }),
  setImagePanelVisible: (imagePanelVisible) => set({ imagePanelVisible }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  setFullscreen: (fullscreen) => set({ fullscreen }),
  setPopoutOpen: (open) => set({ popoutOpen: open })
}))
