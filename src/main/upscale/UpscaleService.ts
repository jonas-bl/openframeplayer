import type { UpscaleModelId, UpscaleModelStatus } from '@shared/upscale'
import type { UpscaleBackend, UpscaleTile } from '@shared/ipc'
import type { ProgressFn, UpscaleModelStore } from './UpscaleModelStore'

/**
 * Runs super-resolution in the MAIN process via onnxruntime-node.
 *
 * Inference lives here (not the renderer) so it can use the **DirectML**
 * execution provider — real GPU acceleration on any DX12 adapter (the user's
 * NVIDIA card included). Chromium's WebGPU EP loads these ESRGAN graphs but
 * can't execute their Conv kernels, so the renderer path was stuck on CPU; this
 * is ~20–25× faster on a dedicated GPU. CPU is kept only as a last-resort
 * fallback for machines without a usable GPU.
 *
 * The renderer drives the tiling loop and ships one RGBA tile per call, which
 * keeps payloads small and lets it paint tiles as they complete. The session is
 * cached for the loaded model and rebuilt when the model changes.
 */

// onnxruntime-node is a native addon loaded lazily (and externalized from the
// bundle); type it loosely to avoid a hard compile-time dependency.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Ort = any
type Session = any

let ortPromise: Promise<Ort> | null = null
async function loadOrt(): Promise<Ort> {
  if (!ortPromise) ortPromise = import('onnxruntime-node') as Promise<Ort>
  return ortPromise
}

export class UpscaleService {
  private cached: { id: UpscaleModelId; session: Session; backend: UpscaleBackend } | null = null
  /** De-dupes concurrent loads of the same model into one session build. */
  private loading: Promise<{ backend: UpscaleBackend }> | null = null

  constructor(private readonly store: UpscaleModelStore) {}

  status(): Promise<UpscaleModelStatus> {
    return this.store.status()
  }

  async remove(id: UpscaleModelId): Promise<boolean> {
    if (this.cached?.id === id) {
      this.cached.session.release?.()
      this.cached = null
    }
    return this.store.remove(id)
  }

  /**
   * Downloads (if needed) and builds the session, preferring the GPU and
   * falling back to CPU only if the GPU provider can't load/run the model.
   */
  async load(id: UpscaleModelId, onProgress?: ProgressFn): Promise<{ backend: UpscaleBackend }> {
    if (this.cached?.id === id) return { backend: this.cached.backend }
    if (this.loading) return this.loading
    this.loading = this.build(id, onProgress).finally(() => {
      this.loading = null
    })
    return this.loading
  }

  private async build(
    id: UpscaleModelId,
    onProgress?: ProgressFn
  ): Promise<{ backend: UpscaleBackend }> {
    const ort = await loadOrt()
    const path = await this.store.ensure(id, onProgress)

    const create = (provider: string): Promise<Session> =>
      ort.InferenceSession.create(path, {
        executionProviders: [provider],
        graphOptimizationLevel: 'all'
      })

    let session: Session = null
    let backend: UpscaleBackend = 'gpu'
    try {
      session = await create('dml')
      await this.warmUp(ort, session)
    } catch {
      session?.release?.()
      session = await create('cpu')
      backend = 'cpu'
    }

    this.cached?.session.release?.()
    this.cached = { id, session, backend }
    return { backend }
  }

  /** Proves the bound provider can actually execute a Conv before we rely on it. */
  private async warmUp(ort: Ort, session: Session): Promise<void> {
    const probe = new ort.Tensor('float32', new Float32Array(3 * 16 * 16), [1, 3, 16, 16])
    const out = await session.run({ [session.inputNames[0]]: probe })
    out[session.outputNames[0]]?.dispose?.()
  }

  /** Super-resolves one RGBA tile, returning the scaled RGBA tile. */
  async tile(id: UpscaleModelId, tile: UpscaleTile): Promise<UpscaleTile> {
    const ort = await loadOrt()
    if (this.cached?.id !== id) await this.load(id)
    const session = this.cached!.session

    const input = rgbaToCHW(tile.rgba, tile.width, tile.height)
    const tensor = new ort.Tensor('float32', input, [1, 3, tile.height, tile.width])
    const result = await session.run({ [session.inputNames[0]]: tensor })
    const output = result[session.outputNames[0]]
    const [, , oh, ow] = output.dims as number[]
    const rgba = chwToRGBA(output.data as Float32Array, ow, oh)
    output.dispose?.()
    return { rgba, width: ow, height: oh }
  }

  dispose(): void {
    this.cached?.session.release?.()
    this.cached = null
  }
}

/** Packs RGBA bytes into planar CHW float32 in [0,1] (RGB only). */
function rgbaToCHW(rgba: Uint8Array, w: number, h: number): Float32Array {
  const plane = w * h
  const out = new Float32Array(plane * 3)
  for (let i = 0; i < plane; i++) {
    const s = i * 4
    out[i] = rgba[s] / 255
    out[plane + i] = rgba[s + 1] / 255
    out[2 * plane + i] = rgba[s + 2] / 255
  }
  return out
}

/** Unpacks a planar CHW float32 [0,1] tensor back into RGBA bytes (opaque). */
function chwToRGBA(chw: Float32Array, w: number, h: number): Uint8Array {
  const plane = w * h
  const rgba = new Uint8Array(plane * 4)
  for (let i = 0; i < plane; i++) {
    const d = i * 4
    rgba[d] = clamp8(chw[i])
    rgba[d + 1] = clamp8(chw[plane + i])
    rgba[d + 2] = clamp8(chw[2 * plane + i])
    rgba[d + 3] = 255
  }
  return rgba
}

/** Scales a [0,1] float to a clamped 0–255 byte. */
function clamp8(v: number): number {
  const n = v * 255
  return n < 0 ? 0 : n > 255 ? 255 : Math.round(n)
}
