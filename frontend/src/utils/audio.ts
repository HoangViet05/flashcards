import { resolveAssetUrl } from '../api/config'
import type { Card } from '../types'

let current: HTMLAudioElement | null = null
export function playCardAudio(card: Card) {
  const url = resolveAssetUrl(card.audio_url)
  if (url) {
    current?.pause(); current = new Audio(url); void current.play().catch(() => {})
    return
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(card.front_text)
  utterance.lang = 'en-US'; utterance.rate = 0.9
  window.speechSynthesis.speak(utterance)
}
