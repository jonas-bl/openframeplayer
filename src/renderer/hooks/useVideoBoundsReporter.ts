import { useEffect, type RefObject } from 'react'

/**
 * Reports the on-screen video region to the main process so the embedded mpv
 * window can be confined to it (kept clear of the title bar / transport bar).
 *
 * Observes the element for size changes (chrome appearing/disappearing, window
 * resizes) and reports its rectangle in PHYSICAL pixels — getBoundingClientRect
 * is in CSS px, so we scale by devicePixelRatio to match Win32 coordinates.
 */
export function useVideoBoundsReporter(ref: RefObject<HTMLElement>): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const report = (): void => {
      const rect = el.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      window.api.setVideoBounds({
        x: Math.round(rect.left * dpr),
        y: Math.round(rect.top * dpr),
        width: Math.round(rect.width * dpr),
        height: Math.round(rect.height * dpr)
      })
    }

    report()
    const observer = new ResizeObserver(report)
    observer.observe(el)
    window.addEventListener('resize', report)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', report)
    }
  }, [ref])
}
