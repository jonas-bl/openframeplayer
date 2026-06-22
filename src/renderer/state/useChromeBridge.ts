import { useEffect } from 'react'
import { useSettingsStore } from './settingsStore'
import { useUiStore } from './uiStore'

/**
 * Connects the main window's chrome to the main process: seeds + subscribes to
 * settings, and mirrors the fullscreen state into the UI store. Mount once in
 * the main App (the pop-out controls view does not need this).
 */
export function useChromeBridge(): void {
  const applySettings = useSettingsStore((s) => s.applySettings)
  const setFullscreen = useUiStore((s) => s.setFullscreen)
  const setPopoutOpen = useUiStore((s) => s.setPopoutOpen)
  const setImagePanelVisible = useUiStore((s) => s.setImagePanelVisible)

  useEffect(() => {
    let active = true

    // Apply persisted settings and mirror panel-visibility into the UI store.
    const sync = (s: Parameters<typeof applySettings>[0]): void => {
      applySettings(s)
      setImagePanelVisible(s.imagePanelVisible)
    }

    void window.api.getSettings().then((s) => active && sync(s))
    void window.windowControls.isFullscreen().then((f) => active && setFullscreen(f))

    const offSettings = window.api.onSettingsChanged(sync)
    const offFullscreen = window.windowControls.onFullscreenChanged(setFullscreen)
    const offPopout = window.api.onPopoutChanged(setPopoutOpen)

    return () => {
      active = false
      offSettings()
      offFullscreen()
      offPopout()
    }
  }, [applySettings, setFullscreen, setPopoutOpen, setImagePanelVisible])
}
