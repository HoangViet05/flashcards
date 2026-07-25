const STORAGE_KEY = 'flashie:sound'
let context: AudioContext | null = null
export const isSoundOn = () => localStorage.getItem(STORAGE_KEY) !== 'off'
export const setSoundOn = (value: boolean) => localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off')
export function playFeedback(kind: 'correct' | 'wrong') {
  if (!isSoundOn()) return
  try { context = context ?? new AudioContext(); if (context.state === 'suspended') void context.resume(); const now = context.currentTime; const gain = context.createGain(); gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.09, now + .01); gain.gain.exponentialRampToValueAtTime(.0001, now + .18); gain.connect(context.destination); const osc = context.createOscillator(); osc.type = kind === 'correct' ? 'sine' : 'triangle'; osc.frequency.setValueAtTime(kind === 'correct' ? 660 : 300, now); osc.frequency.linearRampToValueAtTime(kind === 'correct' ? 990 : 200, now + .16); osc.connect(gain); osc.start(now); osc.stop(now + .2) } catch { /* Browser audio permission must not block learning. */ }
}
