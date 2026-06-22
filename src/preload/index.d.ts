import type { PlayerApi, WindowControlsApi } from '@shared/ipc'

/** Ambient declarations so the renderer sees the typed preload bridges. */
declare global {
  interface Window {
    api: PlayerApi
    windowControls: WindowControlsApi
  }
}

export {}
