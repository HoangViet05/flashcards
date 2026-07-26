import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { updatePreferences } from '../api/auth'

type AudioState = { silent: boolean; toggleSilent: () => void; feedback: (kind: 'correct' | 'wrong' | 'combo' | 'complete' | 'checkpoint') => void; ui: () => void; playAmbient: (kind: 'focus' | 'reader' | 'boss') => void; stopAmbient: () => void }
const AudioStateContext = createContext<AudioState | undefined>(undefined)

export function AudioProvider({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth(); const [silent, setSilent] = useState(Boolean(user?.preferences?.silent_mode))
  const ambient = useMemo(() => ({ current: null as HTMLAudioElement | null }), [])
  const toggleSilent = useCallback(() => { const next = !silent; setSilent(next); if (user) void updatePreferences({ silent_mode: next }).then(setUser).catch(() => undefined) }, [silent, user, setUser])
  const play = useCallback((asset: string) => { if (silent || typeof Audio === 'undefined') return; const audio = new Audio(`/audio/${asset}.wav`); audio.volume = .28; void audio.play().catch(() => undefined) }, [silent])
  const feedback = useCallback((kind: 'correct' | 'wrong' | 'combo' | 'complete' | 'checkpoint') => play(kind), [play])
  const ui = useCallback(() => play('ui'), [play])
  const stopAmbient = useCallback(() => { ambient.current?.pause(); ambient.current = null }, [ambient])
  const playAmbient = useCallback((kind: 'focus' | 'reader' | 'boss') => { if (silent || typeof Audio === 'undefined') return; stopAmbient(); const audio = new Audio(`/audio/ambient-${kind}.wav`); audio.loop = true; audio.volume = .13; ambient.current = audio; void audio.play().catch(() => undefined) }, [ambient, silent, stopAmbient])
  const value = useMemo(() => ({ silent, toggleSilent, feedback, ui, playAmbient, stopAmbient }), [silent, toggleSilent, feedback, ui, playAmbient, stopAmbient])
  return <AudioStateContext.Provider value={value}>{children}</AudioStateContext.Provider>
}
export function useAudio() { const value = useContext(AudioStateContext); if (!value) throw new Error('AudioProvider is required'); return value }
