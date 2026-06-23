import { useEffect, useMemo, useState } from 'react'
import { useSettingsStore } from '../state/settingsStore'
import { useUiStore } from '../state/uiStore'
import { SplashScreen } from './SplashScreen'
import { Onboarding } from './Onboarding'

/** Visible splash time before the exit fade begins. */
const SPLASH_HOLD_MS = 1800
/** Exit-fade duration; must match `.splash-leaving` in styles/index.css. */
const SPLASH_EXIT_MS = 450

type Phase = 'splash' | 'intro' | 'done'

/**
 * Sequences the launch experience for the main window:
 *
 *   1. an animated **splash** (always, except when the window opened straight
 *      into a media file via "Open with FramePlayer" — then playback isn't
 *      delayed), then
 *   2. a one-time, skippable **feature tour** on first run.
 *
 * The tour is also re-openable on demand (idle screen "Take a tour"), which
 * flips `uiStore.introRequested`. Renders nothing once the sequence is over.
 */
export function StartupOverlay(): JSX.Element | null {
  const launchedWithFile = useMemo(
    () => new URLSearchParams(window.location.search).get('launchedWithFile') === '1',
    []
  )

  const [phase, setPhase] = useState<Phase>(launchedWithFile ? 'done' : 'splash')
  const [splashLeaving, setSplashLeaving] = useState(false)
  const [splashDone, setSplashDone] = useState(launchedWithFile)

  const hasSeenIntro = useSettingsStore((s) => s.settings.hasSeenIntro)
  const settingsLoaded = useSettingsStore((s) => s.loaded)
  const setHasSeenIntro = useSettingsStore((s) => s.setHasSeenIntro)
  const introRequested = useUiStore((s) => s.introRequested)
  const clearIntroRequest = useUiStore((s) => s.clearIntroRequest)

  // Run the splash timeline once (fade in → hold → fade out).
  useEffect(() => {
    if (launchedWithFile) return
    const hold = setTimeout(() => setSplashLeaving(true), SPLASH_HOLD_MS)
    const end = setTimeout(() => setSplashDone(true), SPLASH_HOLD_MS + SPLASH_EXIT_MS)
    return () => {
      clearTimeout(hold)
      clearTimeout(end)
    }
  }, [launchedWithFile])

  // Once the splash is over (and settings have arrived), show the tour on first
  // run, otherwise drop straight into the app.
  useEffect(() => {
    if (phase !== 'splash' || !splashDone || !settingsLoaded) return
    setPhase(hasSeenIntro ? 'done' : 'intro')
  }, [phase, splashDone, settingsLoaded, hasSeenIntro])

  // Re-open the tour on demand from elsewhere in the UI.
  useEffect(() => {
    if (introRequested && phase !== 'intro') setPhase('intro')
  }, [introRequested, phase])

  if (phase === 'splash') return <SplashScreen leaving={splashLeaving} />

  if (phase === 'intro') {
    const close = (): void => {
      setHasSeenIntro(true)
      clearIntroRequest()
      setPhase('done')
    }
    return <Onboarding onClose={close} />
  }

  return null
}
