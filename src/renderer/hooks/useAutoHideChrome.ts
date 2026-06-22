import { useEffect, useState } from 'react'

const IDLE_MS = 2500

/**
 * Returns whether the player chrome (transport bar, image panel) should be
 * visible. When `autoHide` is on (fullscreen with media) the chrome reveals on
 * pointer/keyboard activity and fades after a short idle, for an immersive view
 * — pausing does not reveal it, only activity does. When off (windowed or no
 * media) it stays visible.
 */
export function useAutoHideChrome(autoHide: boolean): boolean {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!autoHide) {
      setVisible(true)
      return
    }

    let timer: ReturnType<typeof setTimeout>
    const reveal = (): void => {
      setVisible(true)
      clearTimeout(timer)
      timer = setTimeout(() => setVisible(false), IDLE_MS)
    }

    reveal()
    window.addEventListener('pointermove', reveal)
    window.addEventListener('keydown', reveal)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pointermove', reveal)
      window.removeEventListener('keydown', reveal)
    }
  }, [autoHide])

  return visible
}
