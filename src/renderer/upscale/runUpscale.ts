import { UPSCALE_MODELS, type UpscaleModelId } from '@shared/upscale'
import type { UpscaleBackend } from '@shared/ipc'

/**
 * Screenshot super-resolution, orchestrated from the renderer.
 *
 * The heavy lifting (the ONNX session + Conv kernels) runs in the MAIN process
 * via onnxruntime-node + DirectML — see `main/upscale/UpscaleService`. The
 * renderer only rasterises the source, walks it in tiles, and ships one RGBA
 * tile per IPC call, drawing each scaled tile back as it returns. That keeps GPU
 * memory bounded, payloads small, and lets the UI paint progress tile-by-tile.
 *
 * Tiling uses the Real-ESRGAN "tile_pad" scheme: each tile is run with a margin
 * of surrounding context (PAD), and only the un-padded core is stitched into the
 * output so there are no visible seams.
 */

const TILE = 256
const PAD = 16

let backendPromise: Promise<UpscaleBackend> | null = null
let backendModel: UpscaleModelId | null = null

/**
 * Ensures the model is downloaded and its inference session is built in the main
 * process. Resolves with the bound backend (`gpu` via DirectML, or `cpu`).
 * Download progress arrives separately via `window.api.onUpscaleProgress`.
 */
export async function loadUpscaleModel(id: UpscaleModelId): Promise<UpscaleBackend> {
  if (backendModel !== id) {
    backendModel = id
    backendPromise = window.api.loadUpscaleModel(id).then((r) => r.backend)
  }
  return backendPromise as Promise<UpscaleBackend>
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface UpscaleOptions {
  modelId: UpscaleModelId
  /** Region of the source to upscale; defaults to the whole image. */
  crop?: Rect
  /** Reports inference progress as tiles complete (0..1). */
  onProgress?: (fraction: number) => void
  /** Called once the output canvas exists, before any tile is drawn. */
  onStart?: (output: HTMLCanvasElement, scale: number) => void
  /** Marks the tile about to be processed, in OUTPUT-pixel coordinates. */
  onTile?: (rect: Rect) => void
}

/** An image source we can both draw and measure. */
type Measurable = CanvasImageSource & {
  width?: number
  height?: number
  naturalWidth?: number
  naturalHeight?: number
}

/** Upscales a source image (or a region of it) and returns a new canvas. */
export async function runUpscale(source: Measurable, opts: UpscaleOptions): Promise<HTMLCanvasElement> {
  const scale = UPSCALE_MODELS[opts.modelId].scale

  // Rasterise the source region we're going to upscale.
  const fullW = source.naturalWidth || (source.width as number)
  const fullH = source.naturalHeight || (source.height as number)
  const sw = Math.round(opts.crop?.w ?? fullW)
  const sh = Math.round(opts.crop?.h ?? fullH)
  const sx = Math.round(opts.crop?.x ?? 0)
  const sy = Math.round(opts.crop?.y ?? 0)
  const srcData = rasterise(source, sx, sy, sw, sh)

  const out = document.createElement('canvas')
  out.width = sw * scale
  out.height = sh * scale
  const outCtx = out.getContext('2d')
  if (!outCtx) throw new Error('Canvas unavailable')
  opts.onStart?.(out, scale)

  const cols = Math.ceil(sw / TILE)
  const rows = Math.ceil(sh / TILE)
  let done = 0

  for (let ty = 0; ty < sh; ty += TILE) {
    for (let tx = 0; tx < sw; tx += TILE) {
      const w = Math.min(TILE, sw - tx)
      const h = Math.min(TILE, sh - ty)

      // Padded input region (clamped to the image bounds).
      const px0 = Math.max(0, tx - PAD)
      const py0 = Math.max(0, ty - PAD)
      const px1 = Math.min(sw, tx + w + PAD)
      const py1 = Math.min(sh, ty + h + PAD)
      const pw = px1 - px0
      const ph = py1 - py0

      opts.onTile?.({ x: tx * scale, y: ty * scale, w: w * scale, h: h * scale })

      const rgba = extractRGBA(srcData, sw, px0, py0, pw, ph)
      const result = await window.api.upscaleTile(opts.modelId, { rgba, width: pw, height: ph })

      const tileImage = new ImageData(new Uint8ClampedArray(result.rgba), result.width, result.height)
      const tileCanvas = document.createElement('canvas')
      tileCanvas.width = result.width
      tileCanvas.height = result.height
      tileCanvas.getContext('2d')!.putImageData(tileImage, 0, 0)

      // Copy only the un-padded portion of this tile into the output.
      outCtx.drawImage(
        tileCanvas,
        (tx - px0) * scale,
        (ty - py0) * scale,
        w * scale,
        h * scale,
        tx * scale,
        ty * scale,
        w * scale,
        h * scale
      )

      done += 1
      opts.onProgress?.(done / (cols * rows))
      // Yield so the UI can paint the freshly-drawn tile and the next highlight.
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  return out
}

/** Draws a source region to a canvas and returns its RGBA pixels. */
function rasterise(source: CanvasImageSource, sx: number, sy: number, sw: number, sh: number): Uint8ClampedArray {
  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh)
  return ctx.getImageData(0, 0, sw, sh).data
}

/** Copies a sub-rectangle of RGBA pixels out into a tightly-packed RGBA buffer. */
function extractRGBA(
  rgba: Uint8ClampedArray,
  stride: number,
  x0: number,
  y0: number,
  w: number,
  h: number
): Uint8Array {
  const out = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    const srcRow = ((y0 + y) * stride + x0) * 4
    out.set(rgba.subarray(srcRow, srcRow + w * 4), y * w * 4)
  }
  return out
}
