import { useEffect, useRef } from 'react'
import { usePlayerStore, selectPlayback } from '../../state/playerStore'

const W = 256 // scope canvas width (also histogram bin count)
const HIST_H = 90
const WAVE_H = 90
const SAMPLE_MS = 400 // how often to resample while playing

/**
 * Colour scopes panel: an RGB histogram and a luma waveform of the current
 * frame. Self-contained — it grabs a downscaled frame via `captureFrame`
 * (native GDI of the video region, BGRA) and draws on a canvas, so it works
 * identically docked or in the detached panel window. Resamples on a timer
 * while playing and once whenever the playhead moves.
 */
export function ScopesPanel(): JSX.Element {
  const histRef = useRef<HTMLCanvasElement>(null)
  const waveRef = useRef<HTMLCanvasElement>(null)
  const { paused, position, filePath } = usePlayerStore(selectPlayback)

  useEffect(() => {
    if (!filePath) return
    let cancelled = false

    const sample = async (): Promise<void> => {
      const frame = await window.api.captureFrame(320)
      if (cancelled || !frame) return
      draw(histRef.current, waveRef.current, frame)
    }

    void sample()
    // Keep refreshing while playing; a paused frame is sampled once (the
    // position-effect dep re-runs this on each seek).
    const timer = paused ? null : setInterval(() => void sample(), SAMPLE_MS)
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [filePath, paused, position])

  return (
    <div className="space-y-2">
      <Scope label="RGB histogram" canvasRef={histRef} height={HIST_H} />
      <Scope label="Luma waveform" canvasRef={waveRef} height={WAVE_H} />
    </div>
  )
}

function Scope({
  label,
  canvasRef,
  height
}: {
  label: string
  canvasRef: React.RefObject<HTMLCanvasElement>
  height: number
}): JSX.Element {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <canvas
        ref={canvasRef}
        width={W}
        height={height}
        className="w-full rounded bg-black"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  )
}

/** Computes + paints the histogram and waveform from a captured BGRA frame. */
function draw(
  hist: HTMLCanvasElement | null,
  wave: HTMLCanvasElement | null,
  frame: { w: number; h: number; data: Uint8Array }
): void {
  const { w, h, data } = frame
  if (hist) drawHistogram(hist, data)
  if (wave) drawWaveform(wave, data, w, h)
}

function drawHistogram(canvas: HTMLCanvasElement, bgra: Uint8Array): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const r = new Float32Array(W)
  const g = new Float32Array(W)
  const b = new Float32Array(W)
  for (let i = 0; i < bgra.length; i += 4) {
    b[bgra[i]]++
    g[bgra[i + 1]]++
    r[bgra[i + 2]]++
  }
  const max = Math.max(peak(r), peak(g), peak(b), 1)
  const { width, height } = canvas
  ctx.clearRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'lighter'
  plot(ctx, r, max, height, '#f87171')
  plot(ctx, g, max, height, '#4ade80')
  plot(ctx, b, max, height, '#60a5fa')
  ctx.globalCompositeOperation = 'source-over'
}

function drawWaveform(canvas: HTMLCanvasElement, bgra: Uint8Array, w: number, h: number): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width, height } = canvas
  // Per output column, accumulate luma counts by brightness row (a luma waveform).
  const img = ctx.createImageData(width, height)
  const colStep = w / width
  for (let x = 0; x < width; x++) {
    const srcX0 = Math.floor(x * colStep)
    const srcX1 = Math.max(srcX0 + 1, Math.floor((x + 1) * colStep))
    for (let sy = 0; sy < h; sy++) {
      for (let sx = srcX0; sx < srcX1; sx++) {
        const i = (sy * w + sx) * 4
        const luma = (bgra[i + 2] * 0.299 + bgra[i + 1] * 0.587 + bgra[i] * 0.114) / 255
        const y = Math.min(height - 1, Math.round((1 - luma) * (height - 1)))
        const p = (y * width + x) * 4
        img.data[p] = Math.min(255, img.data[p] + 40)
        img.data[p + 1] = Math.min(255, img.data[p + 1] + 200)
        img.data[p + 2] = Math.min(255, img.data[p + 2] + 90)
        img.data[p + 3] = 255
      }
    }
  }
  ctx.putImageData(img, 0, 0)
}

function peak(arr: Float32Array): number {
  let m = 0
  for (const v of arr) if (v > m) m = v
  return m
}

function plot(
  ctx: CanvasRenderingContext2D,
  arr: Float32Array,
  max: number,
  height: number,
  color: string
): void {
  ctx.beginPath()
  ctx.moveTo(0, height)
  for (let x = 0; x < arr.length; x++) {
    ctx.lineTo(x, height - (arr[x] / max) * height)
  }
  ctx.lineTo(arr.length - 1, height)
  ctx.fillStyle = color
  ctx.globalAlpha = 0.6
  ctx.fill()
  ctx.globalAlpha = 1
}
