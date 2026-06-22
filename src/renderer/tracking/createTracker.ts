import type { TrackingEngine } from '@shared/settings'
import type { Tracker } from './types'
import { BuiltinTracker } from './engines/builtin'

/**
 * Builds a tracker for the chosen engine, lazily loading heavy engines only
 * when selected. Any failure (engine wasn't compiled with a tracker, model not
 * installed, etc.) transparently falls back to the dependency-free built-in
 * tracker so motion tracking always works.
 */
export async function createTracker(engine: TrackingEngine): Promise<Tracker> {
  try {
    if (engine === 'opencv') {
      return await (await import('./engines/opencv')).createOpenCvTracker()
    }
    if (engine === 'ml') {
      return await (await import('./engines/ml')).createMlTracker()
    }
  } catch (err) {
    console.info(
      `[tracking] "${engine}" engine unavailable; using built-in tracker:`,
      err instanceof Error ? err.message : err
    )
  }
  return new BuiltinTracker()
}
