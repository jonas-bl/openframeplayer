import {
  IMAGE_PROVIDERS,
  type ImageGenRequest,
  type ImageGenResult,
  type ImageProviderId
} from '@shared/imageGen'
import type { SettingsStore } from '../settings/SettingsStore'

/**
 * Runs bring-your-own-key AI image operations (enhance / regenerate) against a
 * hosted provider. The HTTP call lives in the main process on purpose: Node's
 * `fetch` has no CORS restrictions, and the user's key is read straight from the
 * authoritative {@link SettingsStore} so it never has to round-trip through the
 * renderer on every request.
 *
 * Every provider exposes a synchronous "image + prompt -> one image" endpoint,
 * so the whole surface is a single {@link generate} call returning PNG bytes.
 */
export class ImageGenService {
  constructor(private readonly settings: SettingsStore) {}

  async generate(request: ImageGenRequest): Promise<ImageGenResult> {
    const settings = this.settings.getSettings()
    const provider = settings.imageProvider
    const key = (settings.imageApiKeys[provider] ?? '').trim()
    if (!key) {
      throw new Error(
        `No API key set for ${IMAGE_PROVIDERS[provider].label}. Add one in Settings → AI image.`
      )
    }

    const image = provider === 'openai' ? await openai(key, request) : await stability(key, request)
    return { image }
  }
}

/**
 * Wraps the source bytes as a PNG file part for a multipart upload. Copies into
 * a fresh ArrayBuffer-backed array so the Blob part is typed concretely (the
 * IPC-delivered view may be backed by a non-ArrayBuffer buffer).
 */
function imagePart(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy.buffer], { type: 'image/png' })
}

/**
 * OpenAI Images "edits" endpoint with `gpt-image-1`. Both ops are an edit of the
 * source image; only the prompt differs. The model always returns base64 PNG.
 */
async function openai(key: string, request: ImageGenRequest): Promise<Uint8Array> {
  const form = new FormData()
  form.append('model', 'gpt-image-2-2026-04-21')
  form.append('image', imagePart(request.image), 'image.png')
  form.append('prompt', request.prompt)
  form.append('size', 'auto')
  form.append('quality', 'high')

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form
  })

  const text = await res.text()
  let json: { data?: { b64_json?: string }[]; error?: { message?: string } }
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`OpenAI: unexpected response (HTTP ${res.status})`)
  }
  if (!res.ok) throw new Error(`OpenAI: ${json.error?.message ?? res.statusText}`)

  const b64 = json.data?.[0]?.b64_json
  if (!b64) throw new Error('OpenAI: no image returned')
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

const STABILITY_BASE = 'https://api.stability.ai/v2beta/stable-image'

/**
 * Stability AI v2beta Stable Image. `enhance` uses conservative upscale (keeps
 * the composition while cleaning/sharpening); `regenerate` uses SD3.5
 * image-to-image driven by the user's prompt. With `Accept: image/*` both return
 * the raw image bytes synchronously; errors come back as JSON.
 */
async function stability(key: string, request: ImageGenRequest): Promise<Uint8Array> {
  const form = new FormData()
  form.append('image', imagePart(request.image), 'image.png')
  form.append('output_format', 'png')
  form.append('prompt', request.prompt)

  let url: string
  if (request.op === 'enhance') {
    url = `${STABILITY_BASE}/upscale/conservative`
  } else {
    url = `${STABILITY_BASE}/generate/sd3`
    form.append('mode', 'image-to-image')
    form.append('strength', '0.6')
    form.append('model', 'sd3.5-large')
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, Accept: 'image/*' },
    body: form
  })

  if (!res.ok) throw new Error(`Stability AI: ${await stabilityError(res)}`)
  return new Uint8Array(Buffer.from(await res.arrayBuffer()))
}

/** Extracts a readable message from a Stability error body (JSON or text). */
async function stabilityError(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const json = JSON.parse(text) as { errors?: string[]; message?: string }
    if (json.errors?.length) return json.errors.join(', ')
    if (json.message) return json.message
  } catch {
    /* fall through to raw text */
  }
  return text || res.statusText
}

/** Re-export so callers (the bridge) can name the provider type if needed. */
export type { ImageProviderId }
