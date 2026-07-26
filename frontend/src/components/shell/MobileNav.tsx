import { NavLink } from 'react-router-dom'
import type { IconName } from '../icons/Icon'
import Icon from '../icons/Icon'
import { primaryNavigation } from './DesktopRail'

const moreLinks: Array<{ to: string; label: string; icon: IconName }> = [
  { to: '/library', label: 'Library', icon: 'library' },
  { to: '/weak', label: 'Weak words', icon: 'weak' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
  { to: '/account', label: 'Account', icon: 'account' },
]

export default function MobileNav({ moreOpen, onToggleMore }: { moreOpen: boolean; onToggleMore: () => void }) {
  return <>
    <div className={`mobile-more-panel${moreOpen ? ' is-open' : ''}`} aria-hidden={!moreOpen}>
      {moreLinks.map((item) => <NavLink key={item.to} to={item.to} onClick={onToggleMore}><Icon name={item.icon} /> {item.label}</NavLink>)}
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {primaryNavigation.map((item) => <NavLink key={item.to} className="mobile-nav__link" to={item.to} end={item.to === '/'}><Icon name={item.icon} /><span>{item.label}</span></NavLink>)}
      <button className="mobile-nav__link mobile-nav__link--button" type="button" aria-label="More navigation" aria-expanded={moreOpen} onClick={onToggleMore}><Icon name="more" /><span>More</span></button>
    </nav>
  </>
}
