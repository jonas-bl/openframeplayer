import { APP_COMMANDS, DEFAULT_KEYBINDINGS, type AppCommand } from './commands'
import { DEFAULT_UPSCALE_MODEL, asUpscaleModelId, type UpscaleModelId } from './upscale'
import {
  DEFAULT_IMAGE_PROVIDER,
  IMAGE_PROVIDER_IDS,
  asImageProviderId,
  type ImageProviderId
} from './imageGen'
import { DEFAULT_ANALYSIS, mergeAnalysis, type AnalysisSettings } from './panels'
import { FEATURES, DEFAULT_CUSTOM_FEATURES, type Feature } from './featureVisibility'

/**
 * Engine used for motion tracking (motion-follow drawings + keep-centred
 * autofocus). `builtin` is a light dependency-free correlation tracker (the
 * default — always available); `opencv` is a robust CSRT region tracker;
 * `ml` is an experimental GPU detector. Both heavier engines fall back to
 * `builtin` automatically if they can't load.
 */
export type TrackingEngine = 'builtin' | 'opencv' | 'ml'

export const TRACKING_ENGINES: TrackingEngine[] = ['builtin', 'opencv', 'ml']

/**
 * UI complexity tier. Gates *visibility only* — every capability stays reachable
 * via keybindings regardless of mode. `casual` shows the essentials (play, seek,
 * volume, speed, tracks, playlist); `standard` (the default) is the full
 * everyday player; `pro` additionally surfaces the analysis tools (measurement,
 * scopes, frame-diff, comparison, frame export). `custom` ignores the tiers and
 * shows exactly the features the user switches on ({@link AppSettings.customFeatures}).
 * See `featureVisibility.ts` for the per-feature tier map.
 */
export type AppMode = 'casual' | 'standard' | 'pro' | 'custom'

export const APP_MODES: AppMode[] = ['casual', 'standard', 'pro', 'custom']

/**
 * The drawing palette's built-in colour slots. Seeds {@link AppSettings.customDrawColors}
 * and is the baseline a reset returns to. Every slot (these included) is editable
 * and persisted, so users can recolour the defaults.
 */
export const DEFAULT_DRAW_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ffffff']

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

/** Normalises a persisted palette: keeps valid hex slots, falls back to defaults. */
function mergeDrawColors(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_DRAW_COLORS]
  const colors = value.filter((c): c is string => typeof c === 'string' && HEX_COLOR.test(c))
  return colors.length > 0 ? colors : [...DEFAULT_DRAW_COLORS]
}

function asAppMode(value: unknown): AppMode | null {
  return value === 'casual' || value === 'standard' || value === 'pro' || value === 'custom'
    ? value
    : null
}

/** Persisted user settings. */
export interface AppSettings {
  /** The bindings for each command; any one of them triggers it. */
  keybindings: Record<AppCommand, string[]>
  /** Folder screenshots are saved to; empty means the app default. */
  screenshotDir: string
  /** Motion-tracking backend. */
  trackingEngine: TrackingEngine
  /** The drawing palette's colour slots (hex strings); seeded with, and including
   * the editable, defaults. See {@link DEFAULT_DRAW_COLORS}. */
  customDrawColors: string[]
  /** Default super-resolution model used by the screenshot editor's upscaler. */
  upscaleModel: UpscaleModelId
  /** Active AI image-generation provider for the editor's Enhance/Regenerate. */
  imageProvider: ImageProviderId
  /** User-supplied API key per provider (bring-your-own-key; stored locally). */
  imageApiKeys: Record<ImageProviderId, string>
  /** UI complexity tier; gates which control groups are shown by default. */
  mode: AppMode
  /** Per-feature visibility switches used only when {@link mode} is `custom`. */
  customFeatures: Record<Feature, boolean>
  /** Pro-mode analysis panel layout + options. */
  analysis: AnalysisSettings
  /** Whether the first-run feature tour has been shown (and dismissed) already. */
  hasSeenIntro: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  keybindings: cloneKeybindings(DEFAULT_KEYBINDINGS),
  screenshotDir: '',
  trackingEngine: 'builtin',
  customDrawColors: [...DEFAULT_DRAW_COLORS],
  upscaleModel: DEFAULT_UPSCALE_MODEL,
  imageProvider: DEFAULT_IMAGE_PROVIDER,
  imageApiKeys: emptyImageApiKeys(),
  mode: 'standard',
  customFeatures: { ...DEFAULT_CUSTOM_FEATURES },
  analysis: DEFAULT_ANALYSIS,
  hasSeenIntro: false
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

/** Normalises persisted custom-feature switches onto the defaults (per feature). */
function mergeCustomFeatures(
  partial: Partial<Record<Feature, unknown>> | undefined
): Record<Feature, boolean> {
  const result = {} as Record<Feature, boolean>
  for (const feature of FEATURES) {
    const value = partial?.[feature]
    result[feature] = typeof value === 'boolean' ? value : DEFAULT_CUSTOM_FEATURES[feature]
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
    customDrawColors: mergeDrawColors(partial?.customDrawColors),
    upscaleModel: asUpscaleModelId(partial?.upscaleModel) ?? DEFAULT_SETTINGS.upscaleModel,
    imageProvider: asImageProviderId(partial?.imageProvider) ?? DEFAULT_SETTINGS.imageProvider,
    imageApiKeys: mergeImageApiKeys(partial?.imageApiKeys),
    mode: asAppMode(partial?.mode) ?? DEFAULT_SETTINGS.mode,
    customFeatures: mergeCustomFeatures(
      partial?.customFeatures as Partial<Record<Feature, unknown>> | undefined
    ),
    analysis: mergeAnalysis(partial?.analysis),
    hasSeenIntro:
      typeof partial?.hasSeenIntro === 'boolean'
        ? partial.hasSeenIntro
        : DEFAULT_SETTINGS.hasSeenIntro
  }
}
