import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { updatePreferences } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import type { AccentTheme, ThemeMode } from '../types'

type Appearance = { theme: ThemeMode; accent: AccentTheme; reduceEffects: boolean; setTheme: (value: ThemeMode) => void; setAccent: (value: AccentTheme) => void; setReduceEffects: (value: boolean) => void }
const AppearanceContext = createContext<Appearance | undefined>(undefined)
const key = 'flashie.appearance'

function saved() { try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} } }

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth(); const initial = typeof window === 'undefined' ? {} : saved()
  const [theme, setThemeState] = useState<ThemeMode>(user?.preferences?.ui_theme ?? initial.theme ?? 'system')
  const [accent, setAccentState] = useState<AccentTheme>(user?.preferences?.accent_theme ?? initial.accent ?? 'violet-cyan')
  const [reduceEffects, setReduceEffectsState] = useState(Boolean(user?.preferences?.reduce_effects ?? initial.reduceEffects))
  useEffect(() => { const root = document.documentElement; root.dataset.theme = theme; root.dataset.accent = accent; root.dataset.reduceEffects = String(reduceEffects); localStorage.setItem(key, JSON.stringify({ theme, accent, reduceEffects })) }, [theme, accent, reduceEffects])
  const persist = (changes: Record<string, unknown>) => { if (user) void updatePreferences(changes).then(setUser).catch(() => undefined) }
  const value = useMemo(() => ({ theme, accent, reduceEffects, setTheme: (value: ThemeMode) => { setThemeState(value); persist({ ui_theme: value }) }, setAccent: (value: AccentTheme) => { setAccentState(value); persist({ accent_theme: value }) }, setReduceEffects: (value: boolean) => { setReduceEffectsState(value); persist({ reduce_effects: value }) } }), [theme, accent, reduceEffects, user])
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}
export function useAppearance() { const value = useContext(AppearanceContext); if (!value) throw new Error('AppearanceProvider is required'); return value }
