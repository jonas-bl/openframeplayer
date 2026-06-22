import { useEffect } from 'react'
import { usePlayerStore } from './playerStore'

/**
 * Connects the renderer store to the main process exactly once:
 *   - seeds the initial snapshot via `getState()`
 *   - subscribes to pushed state changes
 *   - subscribes to screenshot-saved notifications
 *
 * Returns nothing; mount it once near the app root.
 */
export function usePlayerBridge(): void {
  const applySnapshot = usePlayerStore((s) => s.applySnapshot)
  const setLastScreenshot = usePlayerStore((s) => s.setLastScreenshot)

  useEffect(() => {
    let active = true

    void window.api.getState().then((state) => {
      if (active) applySnapshot(state)
    })

    const offState = window.api.onStateChanged((state) => applySnapshot(state))
    const offShot = window.api.onScreenshotSaved((path) => setLastScreenshot(path))

    return () => {
      active = false
      offState()
      offShot()
    }
  }, [applySnapshot, setLastScreenshot])
}
