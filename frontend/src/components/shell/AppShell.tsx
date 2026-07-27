import { useMemo, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import Icon from '../icons/Icon'
import { useAppearance } from '../../providers/AppearanceProvider'
import { useAudio } from '../../providers/AudioProvider'
import './OrbitalShell.css'
import { defaultOrbitalHeader, OrbitalShellContext } from './OrbitalShellContext'
import RouteTransition from './RouteTransition'

const nav = [{ to: '/', label: 'Today', icon: 'today' as const }, { to: '/reader', label: 'Read', icon: 'read' as const }, { to: '/shadowing', label: 'Speak', icon: 'speak' as const }, { to: '/stats', label: 'Progress', icon: 'progress' as const }]

export default function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation(); const { silent, toggleSilent } = useAudio(); const { theme, setTheme } = useAppearance(); const [header, setHeader] = useState(defaultOrbitalHeader)
  const authPage = pathname === '/login' || pathname === '/register'
  const value = useMemo(() => ({ header, setHeader }), [header])
  if (authPage) return <>{children}</>
  return <OrbitalShellContext.Provider value={value}><div id="flashie-today-directions" data-concept="orbital" data-shell="orbital"><section className="card ftd-screen" aria-label="Flashie application shell"><div className="ftd-atmosphere" aria-hidden="true"><i /><i /><i /></div><aside className="ftd-rail" aria-label="Primary navigation"><div className="ftd-mark"><span /><b>Flashie</b></div><nav>{nav.map(item => <NavLink key={item.to} className={({ isActive }) => isActive ? 'is-active' : ''} to={item.to} end={item.to === '/'} aria-label={item.label}><Icon name={item.icon} /><span>{item.label}</span></NavLink>)}</nav><div className="ftd-rail-bottom"><button type="button" onClick={toggleSilent} aria-label={silent ? 'Turn sound on' : 'Turn silent mode on'}><Icon name={silent ? 'silent' : 'sound'} /></button><Link className="ftd-avatar" to="/account" aria-label="Account">A</Link></div></aside><main className="ftd-main"><header className="ftd-header"><div><span className="ftd-overline">{header.eyebrow}</span><h2>{header.title}</h2></div><div className="ftd-header-actions">{header.streak !== null && <span className="viz-badge"><Icon name="flame" /> {header.streak} day streak</span>}<button className="btn btn-ghost" type="button" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Icon name="moon" /></button></div></header><RouteTransition>{children}</RouteTransition></main><nav className="ftd-mobile-nav" aria-label="Mobile navigation">{nav.map(item => <NavLink key={item.to} className={({ isActive }) => isActive ? 'is-active' : ''} to={item.to} end={item.to === '/'} aria-label={item.label}><Icon name={item.icon} /><span>{item.label}</span></NavLink>)}<button type="button" aria-label="More"><Icon name="more" /><span>More</span></button></nav></section></div></OrbitalShellContext.Provider>
}
