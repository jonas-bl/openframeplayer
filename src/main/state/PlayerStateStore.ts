import {
  DEFAULT_PLAYER_STATE,
  type EngineState,
  type PlayerState
} from '@shared/player-state'

type Listener = (state: PlayerState) => void

/**
 * The main process's single source of truth for {@link PlayerState}.
 *
 * mpv property changes and engine lifecycle events fold into here; the IPC
 * bridge subscribes and forwards every snapshot to the renderer. Keeping the
 * authoritative copy in main (not the renderer) means a renderer reload always
 * re-syncs to the true mpv state.
 */
export class PlayerStateStore {
  private state: PlayerState = DEFAULT_PLAYER_STATE
  private readonly listeners = new Set<Listener>()

  getState(): PlayerState {
    return this.state
  }

  /** Replaces state via an updater and notifies listeners if it changed. */
  update(updater: (current: PlayerState) => PlayerState): void {
    const next = updater(this.state)
    if (next === this.state) return
    this.state = next
    this.emit()
  }

  /** Convenience: patch the engine slice (ready / error). */
  setEngine(patch: Partial<EngineState>): void {
    this.update((current) => ({
      ...current,
      engine: { ...current.engine, ...patch }
    }))
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state)
  }
}
