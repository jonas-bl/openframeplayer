import { APP_COMMANDS, DEFAULT_KEYBINDINGS, type AppCommand } from './commands'
import { DEFAULT_UPSCALE_MODEL, asUpscaleModelId, type UpscaleModelId } from './upscale'
import {
  DEFAULT_IMAGE_PROVIDER,
  IMAGE_PROVIDER_IDS,
  asImageProviderId,
  type ImageProviderId
} from './imageGen'

/**
 * Engine used for motion tracking (motion-follow drawings + keep-centred
 * autofocus). `builtin` is a light dependency-free correlation tracker (the
 * default — always available); `opencv` is a robust CSRT region tracker;
 * `ml` is an experimental GPU detector. Both heavier engines fall back to
 * `builtin` automatically if they can't load.
 */
export type TrackingEngine = 'builtin' | 'opencv' | 'ml'

export const TRACKING_ENGINES: TrackingEngine[] = ['builtin', 'opencv', 'ml']

/** Persisted user settings. */
export interface AppSettings {
  /** The bindings for each command; any one of them triggers it. */
  keybindings: Record<AppCommand, string[]>
  /** Folder screenshots are saved to; empty means the app default. */
  screenshotDir: string
  /** Motion-tracking backend. */
  trackingEngine: TrackingEngine
  /**
   * Whether the image-adjustment controls are shown. Persisted so the panel
   * stays in the state you left it across videos and sessions.
   */
  imagePanelVisible: boolean
  /** User-defined colour slots for the drawing palette (hex strings). */
  customDrawColors: string[]
  /** Default super-resolution model used by the screenshot editor's upscaler. */
  upscaleModel: UpscaleModelId
  /** Active AI image-generation provider for the editor's Enhance/Regenerate. */
  imageProvider: ImageProviderId
  /** User-supplied API key per provider (bring-your-own-key; stored locally). */
  imageApiKeys: Record<ImageProviderId, string>
}

export const DEFAULT_SETTINGS: AppSettings = {
  keybindings: cloneKeybindings(DEFAULT_KEYBINDINGS),
  screenshotDir: '',
  trackingEngine: 'builtin',
  imagePanelVisible: false,
  customDrawColors: [],
  upscaleModel: DEFAULT_UPSCALE_MODEL,
  imageProvider: DEFAULT_IMAGE_PROVIDER,
  imageApiKeys: emptyImageApiKeys()
}

/** A fresh, empty key map with an entry for every known provider. */
function emptyImageApiKeys(): Record<ImageProviderId, string> {
  const result = {} as Record<ImageProviderId, string>
  for (const id of IMAGE_PROVIDER_IDS) result[id] = ''
  return result
}

/** Normalises a (possibly partial/stale) persisted key map onto every provider. */
function mergeImageApiKeys(
  partial: Partial<Record<ImageProviderId, unknown>> | undefined
): Record<ImageProviderId, string> {
  const result = emptyImageApiKeys()
  for (const id of IMAGE_PROVIDER_IDS) {
    const value = partial?.[id]
    if (typeof value === 'string') result[id] = value
  }
  return result
}

/** Deep-copies a keybinding map so callers never share the default arrays. */
function cloneKeybindings(source: Record<AppCommand, string[]>): Record<AppCommand, string[]> {
  const result = {} as Record<AppCommand, string[]>
  for (const command of APP_COMMANDS) result[command] = [...source[command]]
  return result
}

/**
 * Normalises a (possibly partial or stale) persisted keybinding map onto the
 * defaults. Missing commands fall back to their default bindings; a legacy
 * single-string binding is accepted and wrapped into a one-element array.
 */
function mergeKeybindings(
  partial: Partial<Record<AppCommand, string | string[]>> | undefined
): Record<AppCommand, string[]> {
  const result = {} as Record<AppCommand, string[]>
  for (const command of APP_COMMANDS) {
    const value = partial?.[command]
    if (Array.isArray(value)) result[command] = [...value]
    else if (typeof value === 'string') result[command] = [value]
    else result[command] = [...DEFAULT_KEYBINDINGS[command]]
  }
  return result
}

/**
 * Merges persisted settings over the defaults, tolerating partial or stale
 * files (missing keys fall back to defaults). Pure and unit-tested.
 */
export function mergeSettings(partial: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    keybindings: mergeKeybindings(
      partial?.keybindings as Partial<Record<AppCommand, string | string[]>> | undefined
    ),
    screenshotDir: partial?.screenshotDir ?? DEFAULT_SETTINGS.screenshotDir,
    trackingEngine: partial?.trackingEngine ?? DEFAULT_SETTINGS.trackingEngine,
    imagePanelVisible: partial?.imagePanelVisible ?? DEFAULT_SETTINGS.imagePanelVisible,
    customDrawColors: partial?.customDrawColors ?? DEFAULT_SETTINGS.customDrawColors,
    upscaleModel: asUpscaleModelId(partial?.upscaleModel) ?? DEFAULT_SETTINGS.upscaleModel,
    imageProvider: asImageProviderId(partial?.imageProvider) ?? DEFAULT_SETTINGS.imageProvider,
    imageApiKeys: mergeImageApiKeys(partial?.imageApiKeys)
  }
}
