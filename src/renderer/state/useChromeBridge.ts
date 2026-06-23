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
  const setPanelPopoutOpen = useUiStore((s) => s.setPanelPopoutOpen)
  const setComparisonLinked = useUiStore((s) => s.setComparisonLinked)
  const setAlwaysOnTop = useUiStore((s) => s.setAlwaysOnTop)

  useEffect(() => {
    let active = true

    void window.api.getSettings().then((s) => active && applySettings(s))
    void window.windowControls.isFullscreen().then((f) => active && setFullscreen(f))
    void window.windowControls.isAlwaysOnTop().then((t) => active && setAlwaysOnTop(t))

    const offSettings = window.api.onSettingsChanged(applySettings)
    const offFullscreen = window.windowControls.onFullscreenChanged(setFullscreen)
    const offPopout = window.api.onPopoutChanged(setPopoutOpen)
    const offPanelPopout = window.api.onPanelPopoutChanged(setPanelPopoutOpen)
    const offLink = window.api.onComparisonLinkChanged(setComparisonLinked)
    const offOnTop = window.windowControls.onAlwaysOnTopChanged(setAlwaysOnTop)

    return () => {
      active = false
      offSettings()
      offFullscreen()
      offPopout()
      offPanelPopout()
      offLink()
      offOnTop()
    }
  }, [
    applySettings,
    setFullscreen,
    setPopoutOpen,
    setPanelPopoutOpen,
    setComparisonLinked,
    setAlwaysOnTop
  ])
}
