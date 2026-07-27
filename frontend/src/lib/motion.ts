export type DurationToken = 'instant' | 'fast' | 'snap' | 'base' | 'slow' | 'reward' | 'celebrate'
export type EasingToken = 'out' | 'inout' | 'spring'

const FALLBACK_MS: Record<DurationToken, number> = {
  instant: 90, fast: 150, snap: 180, base: 250, slow: 400, reward: 320, celebrate: 520,
}
const FALLBACK_EASE: Record<EasingToken, string> = {
  out: 'cubic-bezier(.2, .8, .2, 1)',
  inout: 'cubic-bezier(.4, 0, .2, 1)',
  spring: 'cubic-bezier(.34, 1.56, .64, 1)',
}

function readVar(name: string): string {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/**
 * The CSS kill switches use `!important`, which the Web Animations API ignores.
 * Every WAAPI call must therefore consult both flags itself.
 */
export function motionDisabled(): boolean {
  if (typeof window === 'undefined') return true
  if (document.documentElement.dataset.reduceEffects === 'true') return true
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

export function duration(token: DurationToken): number {
  const raw = readVar(`--dur-${token}`)
  const parsed = raw.endsWith('ms') ? Number.parseFloat(raw) : raw.endsWith('s') ? Number.parseFloat(raw) * 1000 : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_MS[token]
}

export function easing(token: EasingToken): string {
  return readVar(`--ease-${token}`) || FALLBACK_EASE[token]
}

function finished(el: Element): Animation {
  const animation = el.animate([], { duration: 0 })
  animation.finish()
  return animation
}

export function animate(el: Element, keyframes: Keyframe[], token: DurationToken, ease: EasingToken = 'out'): Animation {
  if (motionDisabled()) return finished(el)
  return el.animate(keyframes, { duration: duration(token), easing: easing(ease), fill: 'none' })
}

function scaleToken(name: string, fallback: number): number {
  const parsed = Number.parseFloat(readVar(name))
  return Number.isFinite(parsed) ? parsed : fallback
}

export function pop(el: Element): Animation {
  const peak = scaleToken('--scale-pop', 1.18)
  return animate(el, [{ transform: 'scale(1)' }, { transform: `scale(${peak})` }, { transform: 'scale(1)' }], 'reward', 'spring')
}

export function flyUp(el: Element): Animation {
  return animate(el, [
    { opacity: 0, transform: 'translateY(0)' },
    { opacity: 1, transform: 'translateY(-40%)', offset: .3 },
    { opacity: 0, transform: 'translateY(-140%)' },
  ], 'celebrate', 'out')
}
