import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { updatePreferences } from '../api/auth'

type AudioState = { silent: boolean; toggleSilent: () => void; feedback: (kind: 'correct' | 'wrong') => void }
const AudioStateContext = createContext<AudioState | undefined>(undefined)

export function AudioProvider({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth(); const [silent, setSilent] = useState(Boolean(user?.preferences?.silent_mode))
  const toggleSilent = useCallback(() => { const next = !silent; setSilent(next); if (user) void updatePreferences({ silent_mode: next }).then(setUser).catch(() => undefined) }, [silent, user, setUser])
  const feedback = useCallback((kind: 'correct' | 'wrong') => { if (silent || !user?.preferences?.feedback_enabled || typeof window.AudioContext === 'undefined') return; const ctx = new window.AudioContext(); const oscillator = ctx.createOscillator(); const gain = ctx.createGain(); oscillator.frequency.value = kind === 'correct' ? 620 : 190; gain.gain.value = 0.035; oscillator.connect(gain).connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + 0.08) }, [silent, user])
  const value = useMemo(() => ({ silent, toggleSilent, feedback }), [silent, toggleSilent, feedback])
  return <AudioStateContext.Provider value={value}>{children}</AudioStateContext.Provider>
}
export function useAudio() { const value = useContext(AudioStateContext); if (!value) throw new Error('AudioProvider is required'); return value }
