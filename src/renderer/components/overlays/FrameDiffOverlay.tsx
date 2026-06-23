import { useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '../../state/settingsStore'
import type { CapturedFrame } from '@shared/ipc'

/**
 * Onion-skin / frame-difference overlay. When the user pins a reference (from
 * the Frame-diff panel), the *main* window captures the current frame and holds
 * it locally; it's then drawn over the live video — ghosted at an opacity, or
 * blended with `mix-blend-mode: difference` to highlight what moved between the
 * pinned frame and the current one.
 *
 * Pinning is driven by `frameDiff.pinSeq` in the (cross-window) settings, so the
 * panel can live in the detached window while the capture + overlay stay here.
 * Only ever rendered in the main window (over the video region).
 */
export function FrameDiffOverlay(): JSX.Element | null {
  const { opacity, mode, active, pinSeq } = useSettingsStore((s) => s.settings.analysis.frameDiff)
  const [refUrl, setRefUrl] = useState<string | null>(null)
  const capturedSeq = useRef(0)

  // Capture a fresh reference whenever the pin sequence advances.
  useEffect(() => {
    if (!active || pinSeq <= 0 || pinSeq === capturedSeq.current) return
    capturedSeq.current = pinSeq
    let cancelled = false
    void window.api.captureFrame(1280).then((frame) => {
      if (!cancelled && frame) setRefUrl(frameToDataUrl(frame))
    })
    return () => {
      cancelled = true
    }
  }, [active, pinSeq])

  if (!active || !refUrl) return null

  return (
    <img
      src={refUrl}
      alt=""
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{
        opacity: mode === 'difference' ? 1 : opacity,
        mixBlendMode: mode === 'difference' ? 'difference' : 'normal'
      }}
    />
  )
}

/** Converts a top-down BGRA captured frame into a PNG data URL. */
function frameToDataUrl(frame: CapturedFrame): string | null {
  const canvas = document.createElement('canvas')
  canvas.width = frame.w
  canvas.height = frame.h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const img = ctx.createImageData(frame.w, frame.h)
  const src = frame.data
  const dst = img.data
  for (let i = 0; i < src.length; i += 4) {
    dst[i] = src[i + 2] // R <- B-channel position
    dst[i + 1] = src[i + 1] // G
    dst[i + 2] = src[i] // B <- R-channel position
    dst[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}
