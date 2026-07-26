import type { OrbState } from './AiOrb'
const copy: Record<OrbState, string[]> = {
  idle: ['Ready when you are.', 'Your next step is waiting.'], thinking: ['Finding your next focus.'], loading: ['Starting your learning space…'], correct: ['Strong recall.', 'That one is yours.'], wrong: ['Useful signal. Try the next one.'], combo: ['You are in rhythm.'], listening: ['Listen for the detail.'], recording: ['Take your time.'], processing: ['Checking your attempt.'], success: ['Session complete. Keep the momentum.'], offline: ['You are offline. Progress will wait for a connection.'],
}
let last = new Map<OrbState, number>()
export function orbMessage(state: OrbState) { const items = copy[state]; const current = last.get(state) ?? -1; const next = (current + 1) % items.length; last.set(state, next); return items[next] }
