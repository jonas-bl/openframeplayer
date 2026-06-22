/**
 * Curated catalogue of image super-resolution models the screenshot editor can
 * use to upscale a captured frame.
 *
 * Only genuinely strong, widely-vetted models are listed — no weak or novelty
 * ones. All are RRDBNet / ESRGAN-architecture 4× networks distributed as ONNX,
 * which means a single inference path (RGB float NCHW in [0,1], 4× output)
 * drives every one of them. None ship with the app: weights are downloaded on
 * first use and cached under userData, so the base install stays small.
 *
 * Source: the community ONNX upscaler collection at
 * https://huggingface.co/yuvraj108c/ComfyUI-Upscaler-Onnx
 */
export type UpscaleModelId = 'ultrasharp' | 'remacri' | 'animesharp' | 'clearreality'

export interface UpscaleModelDef {
  id: UpscaleModelId
  /** Short display name. */
  label: string
  /** One-line guidance on what content it's best for. */
  description: string
  /** Resolution multiplier the network applies. */
  scale: number
  /** Remote download URL (ONNX). */
  url: string
  /** File name on disk; also the cache key under the models directory. */
  file: string
  /** Approximate download size in bytes (for the UI before downloading). */
  approxBytes: number
}

const REPO = 'https://huggingface.co/yuvraj108c/ComfyUI-Upscaler-Onnx/resolve/main'

export const UPSCALE_MODELS: Record<UpscaleModelId, UpscaleModelDef> = {
  ultrasharp: {
    id: 'ultrasharp',
    label: '4× UltraSharp',
    description: 'General / photographic — crisp, faithful detail. Best all-round default.',
    scale: 4,
    url: `${REPO}/4x-UltraSharp.onnx`,
    file: '4x-UltraSharp.onnx',
    approxBytes: 71_600_000
  },
  remacri: {
    id: 'remacri',
    label: '4× Remacri',
    description: 'Photo / realistic — keeps natural texture without over-smoothing.',
    scale: 4,
    url: `${REPO}/4x_foolhardy_Remacri.onnx`,
    file: '4x_foolhardy_Remacri.onnx',
    approxBytes: 71_600_000
  },
  animesharp: {
    id: 'animesharp',
    label: '4× AnimeSharp',
    description: 'Animation, line-art, cartoons and game footage.',
    scale: 4,
    url: `${REPO}/4x-AnimeSharp.onnx`,
    file: '4x-AnimeSharp.onnx',
    approxBytes: 71_600_000
  },
  clearreality: {
    id: 'clearreality',
    label: '4× ClearReality (light)',
    description: 'Tiny, fast realistic model — great on slower PCs or limited bandwidth.',
    scale: 4,
    url: `${REPO}/4x-ClearRealityV1.onnx`,
    file: '4x-ClearRealityV1.onnx',
    approxBytes: 1_900_000
  }
}

export const UPSCALE_MODEL_IDS = Object.keys(UPSCALE_MODELS) as UpscaleModelId[]

export const DEFAULT_UPSCALE_MODEL: UpscaleModelId = 'ultrasharp'

/** Narrows an arbitrary string to a known model id, or null. */
export function asUpscaleModelId(value: string | null | undefined): UpscaleModelId | null {
  return value && value in UPSCALE_MODELS ? (value as UpscaleModelId) : null
}

/** Installed-state of each model, reported by the main process. */
export type UpscaleModelStatus = Record<UpscaleModelId, boolean>

/** Download progress for a model fetch (`total` is 0 if the server omits it). */
export interface UpscaleProgress {
  id: UpscaleModelId
  received: number
  total: number
}
