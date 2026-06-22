import { create } from 'zustand'
import { DEFAULT_PLAYER_STATE, type PlayerState } from '@shared/player-state'
import type { PlayerAction } from '@shared/player-actions'

/**
 * Renderer-side mirror of the central {@link PlayerState}.
 *
 * The main process is authoritative; this store holds the latest snapshot it
 * pushed and exposes thin helpers that forward semantic actions back over the
 * bridge. Components read state here and dispatch actions — they never see mpv.
 */
interface PlayerStore {
  state: PlayerState
  lastScreenshot: string | null

  /** Replace the local snapshot (called by the bridge with main's state). */
  applySnapshot: (state: PlayerState) => void
  setLastScreenshot: (filePath: string) => void

  /** Forward a semantic action to the main process. */
  dispatch: (action: PlayerAction) => void
  /** Open the native picker and load the chosen file. */
  openFile: () => Promise<void>
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  state: DEFAULT_PLAYER_STATE,
  lastScreenshot: null,

  applySnapshot: (state) => set({ state }),
  setLastScreenshot: (filePath) => set({ lastScreenshot: filePath }),

  dispatch: (action) => {
    void window.api.dispatch(action)
  },

  openFile: async () => {
    const path = await window.api.openFile()
    if (path) void window.api.dispatch({ type: 'load', path })
  }
}))

/** Selector helpers keep component subscriptions narrow and re-renders minimal. */
export const selectEngine = (s: PlayerStore): PlayerState['engine'] => s.state.engine
export const selectPlayback = (s: PlayerStore): PlayerState['playback'] => s.state.playback
export const selectVideo = (s: PlayerStore): PlayerState['video'] => s.state.video
