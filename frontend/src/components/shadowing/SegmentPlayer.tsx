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

  const selectVoiceFromMenu = (nextVoiceURI: string, button: HTMLButtonElement) => {
    selectVoice(nextVoiceURI)
    button.closest('details')?.removeAttribute('open')
  }

  return <div className="voice-picker">
    <span className="voice-picker__label" aria-hidden="true">Voice</span>
    <details className="voice-picker__menu">
      <summary aria-label="Choose reading voice"><span className="voice-picker__speaker" aria-hidden="true">◖◗</span><span className="voice-picker__current"><b>{selectedVoice?.name ?? 'Automatic English'}</b><small>{selectedVoice?.lang ?? 'Use the default English voice'}</small></span><span className="voice-picker__chevron" aria-hidden="true">⌄</span></summary>
      <div className="voice-picker__options" role="listbox" aria-label="Available reading voices">
        <button type="button" className={!voiceURI ? 'is-selected' : ''} onClick={event => selectVoiceFromMenu('', event.currentTarget)}><b>Automatic English</b><small>Use your system default</small></button>
        {availableVoices.map(voice => <button type="button" key={voice.voiceURI} className={voice.voiceURI === voiceURI ? 'is-selected' : ''} onClick={event => selectVoiceFromMenu(voice.voiceURI, event.currentTarget)}><b>{voice.name}</b><small>{voice.lang}</small></button>)}
      </div>
    </details>
  </div>
})
