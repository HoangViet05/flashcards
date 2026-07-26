import { useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useAppearance } from '../../providers/AppearanceProvider'
import { useAudio } from '../../providers/AudioProvider'
import Icon from '../icons/Icon'

const titles: Record<string, { eyebrow: string; title: string }> = {
  '/': { eyebrow: 'Learning OS', title: 'Today' },
  '/reader': { eyebrow: 'Learning OS', title: 'Focus Reader' },
  '/shadowing': { eyebrow: 'Learning OS', title: 'Voice calibration' },
  '/stats': { eyebrow: 'Learning OS', title: 'Progress' },
  '/__visual-fixtures': { eyebrow: 'Visual QA', title: 'Deterministic review state' },
}

export default function PageHeader() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const { theme, setTheme } = useAppearance()
  const { silent, toggleSilent } = useAudio()
  const context = titles[pathname] ?? { eyebrow: 'Learning OS', title: pathname === '/settings' ? 'Settings' : 'Flashie' }
  const dark = theme === 'dark'
  return <header className="page-header">
    <div className="page-header__context"><span className="page-header__eyebrow">{context.eyebrow}</span><h1 className="page-header__title">{context.title}</h1></div>
    <div className="page-header__actions">
      <span className="header-status" title="Current streak"><Icon name="flame" /><span>{user ? '12 day streak' : 'Review mode'}</span></span>
      <button className="header-control" type="button" aria-label={silent ? 'Turn sound on' : 'Turn silent mode on'} onClick={toggleSilent}><Icon name={silent ? 'silent' : 'sound'} /></button>
      <button className="header-control" type="button" aria-label={dark ? 'Use light theme' : 'Use dark theme'} onClick={() => setTheme(dark ? 'light' : 'dark')}><Icon name={dark ? 'sun' : 'moon'} /></button>
    </div>
  </header>
}
