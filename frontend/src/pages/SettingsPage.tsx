import { updatePreferences } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { useAppearance } from '../providers/AppearanceProvider'
import { useAudio } from '../providers/AudioProvider'
import type { AccentTheme, ThemeMode, UserPreferences } from '../types'

export default function SettingsPage() {
  const { user, setUser } = useAuth()
  const { theme, accent, reduceEffects, setTheme, setAccent, setReduceEffects } = useAppearance()
  const { silent, toggleSilent } = useAudio()
  const prefs = (user?.preferences ?? {}) as Partial<UserPreferences>
  const save = (changes: Partial<UserPreferences>) => { void updatePreferences(changes).then(setUser).catch(() => undefined) }

  return <div className="settings-page">
    <header><p className="eyebrow">Your space</p><h1>Settings</h1><p>Preferences are saved to your account when you are signed in.</p></header>

    <section className="glass-panel">
      <h2>Appearance</h2>
      <label>Theme<select value={theme} onChange={event => setTheme(event.target.value as ThemeMode)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
      <label>Accent<select value={accent} onChange={event => setAccent(event.target.value as AccentTheme)}><option value="violet-cyan">Violet–Cyan</option><option value="blue-emerald">Blue–Emerald</option><option value="amber-rose">Amber–Rose</option><option value="graphite-ice">Graphite–Ice</option></select></label>
      <label><input checked={reduceEffects} onChange={event => setReduceEffects(event.target.checked)} type="checkbox" /> Reduce effects</label>
    </section>

    <section className="glass-panel">
      <h2>Sound &amp; haptics</h2>
      <label><input checked={prefs.feedback_enabled !== false} onChange={event => save({ feedback_enabled: event.target.checked })} type="checkbox" /> Learning feedback</label>
      <label><input checked={prefs.sfx_enabled !== false} onChange={event => save({ sfx_enabled: event.target.checked })} type="checkbox" /> Answer sounds</label>
      <label><input checked={prefs.haptic_enabled !== false} onChange={event => save({ haptic_enabled: event.target.checked })} type="checkbox" /> Vibration (Android only)</label>
      <label>Sound volume<input max={1} min={0} onChange={event => save({ sfx_volume: Number(event.target.value) })} step={.1} type="range" value={prefs.sfx_volume ?? .7} /></label>
      <button className="button-secondary" onClick={toggleSilent}>{silent ? 'Turn Silent mode off' : 'Turn Silent mode on'}</button>
      <p>Silent mode turns everything off, including background music and pronunciation. Learning feedback covers answer sounds, vibration and reward motion.</p>
    </section>

    <section className="glass-panel">
      <h2>Daily goal</h2>
      <p>{prefs.daily_goal_minutes ?? 15} minutes · {prefs.timezone ?? 'Asia/Ho_Chi_Minh'}</p>
    </section>
  </div>
}
