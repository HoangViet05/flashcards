import { Link, NavLink } from 'react-router-dom'
import type { IconName } from '../icons/Icon'
import Icon from '../icons/Icon'

export const primaryNavigation: Array<{ to: string; label: string; icon: IconName }> = [
  { to: '/', label: 'Today', icon: 'today' },
  { to: '/reader', label: 'Read', icon: 'read' },
  { to: '/shadowing', label: 'Speak', icon: 'speak' },
  { to: '/stats', label: 'Progress', icon: 'progress' },
]

export default function DesktopRail({ silent, onToggleSilent }: { silent: boolean; onToggleSilent: () => void }) {
  return <aside className="desktop-rail" aria-label="Primary navigation">
    <Link className="brand-orb" to="/" aria-label="Flashie Today"><Icon name="today" /></Link>
    <nav className="rail-nav">
      {primaryNavigation.map((item) => <NavLink key={item.to} className="rail-link" to={item.to} end={item.to === '/'} aria-label={item.label} title={item.label}><Icon name={item.icon} /><span className="sr-only">{item.label}</span></NavLink>)}
    </nav>
    <div className="rail-footer">
      <button className="rail-icon-button" type="button" onClick={onToggleSilent} aria-label={silent ? 'Turn sound on' : 'Turn silent mode on'} title={silent ? 'Silent mode on' : 'Sound on'}><Icon name={silent ? 'silent' : 'sound'} /></button>
      <NavLink className="rail-link" to="/settings" aria-label="Settings" title="Settings"><Icon name="settings" /><span className="sr-only">Settings</span></NavLink>
      <NavLink className="rail-link rail-avatar" to="/account" aria-label="Account" title="Account">HV</NavLink>
    </div>
  </aside>
}
