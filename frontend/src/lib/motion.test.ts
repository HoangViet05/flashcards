import { afterEach, describe, expect, it, vi } from 'vitest'
import { animate, duration, motionDisabled } from './motion'

function setReduceEffects(value: boolean) {
  document.documentElement.dataset.reduceEffects = String(value)
}

function stubMatchMedia(reduced: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced && query.includes('reduce'),
    media: query, onchange: null,
    addListener: () => undefined, removeListener: () => undefined,
    addEventListener: () => undefined, removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }))
}

afterEach(() => { setReduceEffects(false); vi.unstubAllGlobals() })

describe('motionDisabled', () => {
  it('is false by default', () => {
    stubMatchMedia(false)
    expect(motionDisabled()).toBe(false)
  })

  it('is true when the user asked for reduced motion', () => {
    stubMatchMedia(true)
    expect(motionDisabled()).toBe(true)
  })

  it('is true when the app-level reduce-effects flag is on', () => {
    stubMatchMedia(false)
    setReduceEffects(true)
    expect(motionDisabled()).toBe(true)
  })
})

describe('duration', () => {
  it('reads the value from the CSS token, not from a literal', () => {
    document.documentElement.style.setProperty('--dur-reward', '320ms')
    expect(duration('reward')).toBe(320)
  })

  it('falls back to a safe value when the token is missing', () => {
    document.documentElement.style.removeProperty('--dur-celebrate')
    expect(duration('celebrate')).toBeGreaterThan(0)
  })
})

describe('animate', () => {
  it('returns an already-finished animation when motion is disabled', async () => {
    stubMatchMedia(false)
    setReduceEffects(true)
    const el = document.createElement('div')
    document.body.append(el)
    const animation = animate(el, [{ opacity: 0 }, { opacity: 1 }], 'base')
    await expect(animation.finished).resolves.toBeDefined()
    expect(animation.playState).toBe('finished')
  })
})
