import type { Tracker } from '../types'

/**
 * Experimental GPU (WebGPU→WebGL→wasm) tracker via onnxruntime-web.
 *
 * This is the "ML might outperform" option. It expects a detector model at
 * `models/detector.onnx` (served from the renderer's static assets / packaged
 * `resources/models`). No model ships by default, so unless one is installed
 * this throws and the caller transparently falls back to the built-in tracker.
 * The onnxruntime session is created here (proving the runtime + asset path);
 * the per-model detection decode is the remaining piece a concrete model adds.
 */

const MODEL_URL = 'models/detector.onnx'

/** True if the detector model asset is actually present. */
async function modelAvailable(): Promise<boolean> {
  try {
    const res = await fetch(MODEL_URL, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

export async function createMlTracker(): Promise<Tracker> {
  if (!(await modelAvailable())) {
    throw new Error(`ML detector model not installed (expected ${MODEL_URL})`)
  }

  // Lazy-load the runtime only once a model is actually present.
  const ort = await import('onnxruntime-web')
  const session = await ort.InferenceSession.create(MODEL_URL, {
    executionProviders: ['webgpu', 'webgl', 'wasm']
  })

  // A concrete model plugs its pre/post-processing in here. Until then the
  // engine is considered unavailable so tracking falls back to built-in.
  void session
  throw new Error('ML tracker: no decoder configured for the installed model')
}
