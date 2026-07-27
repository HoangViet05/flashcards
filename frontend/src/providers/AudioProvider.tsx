import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { updatePreferences } from '../api/auth'

export type SfxKind = 'correct' | 'wrong' | 'combo' | 'complete' | 'checkpoint' | 'levelup' | 'ui'

type AudioState = { silent: boolean; toggleSilent: () => void; sfx: (kind: SfxKind) => void; feedback: (kind: 'correct' | 'wrong' | 'combo' | 'complete' | 'checkpoint') => void; ui: () => void; playAmbient: (kind: 'focus' | 'reader' | 'boss') => void; stopAmbient: () => void; duckAmbient: (active: boolean) => void }
const AudioStateContext = createContext<AudioState | undefined>(undefined)

export function AudioProvider({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth(); const [silent, setSilent] = useState(Boolean(user?.preferences?.silent_mode))
  const ambient = useMemo(() => ({ current: null as HTMLAudioElement | null }), [])
  const toggleSilent = useCallback(() => { const next = !silent; setSilent(next); if (user) void updatePreferences({ silent_mode: next }).then(setUser).catch(() => undefined) }, [silent, user, setUser])

  const prefs = user?.preferences
  const cache = useMemo(() => new Map<string, HTMLAudioElement>(), [])
  const volume = Math.max(0, Math.min(1, (prefs?.sfx_volume ?? .7) * (prefs?.master_volume ?? .8)))
  const soundAllowed = !silent && prefs?.silent_mode !== true && prefs?.feedback_enabled !== false && prefs?.sfx_enabled !== false

  // Một đối tượng Audio cho mỗi asset. Trước đây mỗi lần phát tạo một đối tượng
  // mới; với nhịp trả lời nhanh sẽ sinh hàng chục đối tượng trong một buổi học.
  const play = useCallback((asset: string) => {
    if (!soundAllowed || typeof Audio === 'undefined') return
    let element = cache.get(asset)
    if (!element) { element = new Audio(`/audio/${asset}.wav`); cache.set(asset, element) }
    element.volume = volume
    element.currentTime = 0
    void element.play().catch(() => undefined)
  }, [cache, soundAllowed, volume])

  const sfx = useCallback((kind: SfxKind) => play(kind), [play])
  const feedback = useCallback((kind: 'correct' | 'wrong' | 'combo' | 'complete' | 'checkpoint') => play(kind), [play])
  const ui = useCallback(() => play('ui'), [play])
  const stopAmbient = useCallback(() => { ambient.current?.pause(); ambient.current = null }, [ambient])
  const duckAmbient = useCallback((active: boolean) => { if (ambient.current) ambient.current.volume = active ? .035 : .13 }, [ambient])
  const playAmbient = useCallback((kind: 'focus' | 'reader' | 'boss') => { if (silent || typeof Audio === 'undefined') return; stopAmbient(); const audio = new Audio(`/audio/ambient-${kind}.wav`); audio.loop = true; audio.volume = .13; ambient.current = audio; void audio.play().catch(() => undefined) }, [ambient, silent, stopAmbient])
  const value = useMemo(() => ({ silent, toggleSilent, sfx, feedback, ui, playAmbient, stopAmbient, duckAmbient }), [silent, toggleSilent, sfx, feedback, ui, playAmbient, stopAmbient, duckAmbient])
  return <AudioStateContext.Provider value={value}>{children}</AudioStateContext.Provider>
}
export function useAudio() { const value = useContext(AudioStateContext); if (!value) throw new Error('AudioProvider is required'); return value }
