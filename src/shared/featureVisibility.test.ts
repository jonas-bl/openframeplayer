import { describe, it, expect } from 'vitest'
import { isVisible, isFeatureVisible, DEFAULT_CUSTOM_FEATURES } from './featureVisibility'

describe('featureVisibility', () => {
  it('shows casual-tier features in every tiered mode', () => {
    for (const mode of ['casual', 'standard', 'pro'] as const) {
      expect(isVisible('speed', mode)).toBe(true)
      expect(isVisible('tracks', mode)).toBe(true)
    }
  })

  it('hides standard-tier features in casual but shows them otherwise', () => {
    expect(isVisible('frameStep', 'casual')).toBe(false)
    expect(isVisible('frameStep', 'standard')).toBe(true)
    expect(isVisible('frameStep', 'pro')).toBe(true)
  })

  it('shows pro-tier features only in pro', () => {
    expect(isVisible('scopes', 'casual')).toBe(false)
    expect(isVisible('scopes', 'standard')).toBe(false)
    expect(isVisible('scopes', 'pro')).toBe(true)
  })
})

describe('isFeatureVisible (custom mode)', () => {
  it('uses the tier for the non-custom modes, ignoring the custom map', () => {
    expect(isFeatureVisible('scopes', 'pro', {})).toBe(true)
    expect(isFeatureVisible('scopes', 'casual', { scopes: true })).toBe(false)
  })

  it('consults the per-feature switches in custom mode', () => {
    expect(isFeatureVisible('scopes', 'custom', { scopes: true })).toBe(true)
    expect(isFeatureVisible('frameStep', 'custom', { frameStep: false })).toBe(false)
  })

  it('falls back to the standard-seeded defaults for unset features in custom mode', () => {
    // frameStep defaults on (standard tier), scopes defaults off (pro tier).
    expect(DEFAULT_CUSTOM_FEATURES.frameStep).toBe(true)
    expect(DEFAULT_CUSTOM_FEATURES.scopes).toBe(false)
    expect(isFeatureVisible('frameStep', 'custom', {})).toBe(true)
    expect(isFeatureVisible('scopes', 'custom', {})).toBe(false)
  })
})
