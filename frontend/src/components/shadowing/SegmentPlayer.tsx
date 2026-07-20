import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { resolveAssetUrl } from '../../api/config'

const VOICE_STORAGE_KEY = 'reader-speech-voice'

export interface PlayerHandle { play: () => void; stop: () => void }

export const Mp3Player = forwardRef<PlayerHandle, { src: string; rate: number }>(function Mp3Player({ src, rate }, ref) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  useImperativeHandle(ref, () => ({
    play: () => { const url = resolveAssetUrl(src); if (!url) return; audioRef.current?.pause(); const audio = new Audio(url); audio.playbackRate = rate; audioRef.current = audio; void audio.play().catch(() => {}) },
    stop: () => audioRef.current?.pause(),
  }), [src, rate])
  useEffect(() => () => audioRef.current?.pause(), [])
  return null
})

export const TtsPlayer = forwardRef<PlayerHandle, { text: string; rate: number }>(function TtsPlayer({ text, rate }, ref) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceURI, setVoiceURI] = useState(() => window.localStorage.getItem(VOICE_STORAGE_KEY) ?? '')
  const availableVoices = useMemo(() => {
    const english = voices.filter(voice => /^en(?:-|_)/i.test(voice.lang))
    return english.length ? english : voices
  }, [voices])
  const selectedVoice = useMemo(() => availableVoices.find(voice => voice.voiceURI === voiceURI), [availableVoices, voiceURI])

  useEffect(() => {
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices())
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [])

  useImperativeHandle(ref, () => ({
    play: () => {
      window.speechSynthesis.cancel()
      const voice = selectedVoice ?? availableVoices[0], utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = voice?.lang || 'en-US'
      if (voice) utterance.voice = voice
      utterance.rate = rate
      window.speechSynthesis.speak(utterance)
    },
    stop: () => window.speechSynthesis.cancel(),
  }), [availableVoices, rate, selectedVoice, text])

  const selectVoice = (nextVoiceURI: string) => {
    window.speechSynthesis.cancel()
    setVoiceURI(nextVoiceURI)
    if (nextVoiceURI) window.localStorage.setItem(VOICE_STORAGE_KEY, nextVoiceURI)
    else window.localStorage.removeItem(VOICE_STORAGE_KEY)
  }

  return <label className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400">
    <span aria-hidden="true">🗣</span>
    <span>Giọng đọc</span>
    <select value={voiceURI} onChange={event => selectVoice(event.target.value)} className="max-w-52 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200 outline-none focus:border-cyan-300/50">
      <option value="">Tự động (tiếng Anh)</option>
      {availableVoices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}
    </select>
  </label>
})
