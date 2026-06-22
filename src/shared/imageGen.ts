/**
 * Bring-your-own-key AI image generation for the screenshot editor.
 *
 * The user supplies their own API key for a hosted provider (no per-token bill
 * to us, no subscription proxying — they pay their own usage). All providers
 * here are synchronous REST endpoints that take an image + prompt and hand back
 * a single edited image, so one request/response shape drives every one of them.
 *
 * The actual HTTP calls run in the main process (see ImageGenService): Node has
 * no CORS restrictions and the key never has to live in the page.
 */
export type ImageProviderId = 'openai' | 'stability'

/**
 * What to do with the current frame:
 * - `enhance`   — one-click clean-up/sharpen using a canned prompt.
 * - `regenerate`— re-imagine the frame from the user's own prompt (img2img).
 */
export type ImageOp = 'enhance' | 'regenerate'

export interface ImageProviderDef {
  id: ImageProviderId
  /** Short display name. */
  label: string
  /** Where the user creates an API key. */
  keyUrl: string
  /** Placeholder shown in the key field. */
  keyHint: string
  /** One-line note on behaviour/limitations, shown under the key field. */
  note: string
}

export const IMAGE_PROVIDERS: Record<ImageProviderId, ImageProviderDef> = {
  openai: {
    id: 'openai',
    label: 'OpenAI · gpt-image-2',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-…',
    note: 'Uses the Images "edits" API. Output is returned at a standard size, so the aspect ratio may change.'
  },
  stability: {
    id: 'stability',
    label: 'Stability AI',
    keyUrl: 'https://platform.stability.ai/account/keys',
    keyHint: 'sk-…',
    note: 'Enhance uses conservative upscale (keeps the composition); Regenerate uses SD3.5 image-to-image.'
  }
}

export const IMAGE_PROVIDER_IDS = Object.keys(IMAGE_PROVIDERS) as ImageProviderId[]

export const DEFAULT_IMAGE_PROVIDER: ImageProviderId = 'openai'

/** Narrows an arbitrary string to a known provider id, or null. */
export function asImageProviderId(value: string | null | undefined): ImageProviderId | null {
  return value && value in IMAGE_PROVIDERS ? (value as ImageProviderId) : null
}

/** Canned instruction used by the one-click Enhance action. */
export const ENHANCE_PROMPT =
  'Restore and remaster this exact photograph to the highest possible quality. This is a ' +
  'faithful restoration, NOT a redraw: reproduce the original image identically and change ' +
  'nothing about its content. ' +
  'Keep every subject, person, face, facial feature and expression, pose, object, background, ' +
  'text, logo, pattern and colour exactly as they are. Preserve the original composition, ' +
  'framing, crop, aspect ratio, perspective, camera angle and the position and proportions of ' +
  'everything in the frame. Do not add, remove, move, duplicate, stylise, beautify or ' +
  'reinterpret anything, and do not invent new details that are not already present. ' +
  'Only improve technical image quality: increase real sharpness and fine detail, recover ' +
  'genuine texture (skin, hair, fabric, foliage), and resolve the existing detail more clearly. ' +
  'Remove noise, grain, blur, JPEG/compression blocks and banding, colour fringing and ' +
  'aliasing. Gently and naturally correct exposure, white balance, contrast and colour only ' +
  'where the image is clearly off, keeping the original mood and lighting. ' +
  'The result must look like a clean, high-resolution photograph of the same scene — ' +
  'photorealistic, natural and free of any artificial, over-sharpened, over-smoothed, ' +
  'plastic or AI-generated look.'

/** A request to transform the current frame (renderer -> main). */
export interface ImageGenRequest {
  op: ImageOp
  /** The prompt (the Enhance action sends {@link ENHANCE_PROMPT}). */
  prompt: string
  /** Source PNG bytes — the current composited frame. */
  image: Uint8Array
}

/** The transformed frame (main -> renderer). */
export interface ImageGenResult {
  /** Result PNG bytes. */
  image: Uint8Array
}
