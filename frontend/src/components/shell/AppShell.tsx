import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useAudio } from '../../providers/AudioProvider'
import AmbientBackground from './AmbientBackground'
import DesktopRail from './DesktopRail'
import MobileNav from './MobileNav'
import PageHeader from './PageHeader'

export default function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const { silent, toggleSilent } = useAudio()
  const [moreOpen, setMoreOpen] = useState(false)
  const authPage = pathname === '/login' || pathname === '/register'
  if (authPage) return <><AmbientBackground />{children}</>
  return <div className="app-shell"><AmbientBackground /><DesktopRail silent={silent} onToggleSilent={toggleSilent} /><div className="shell-content"><PageHeader />{children}</div><MobileNav moreOpen={moreOpen} onToggleMore={() => setMoreOpen((open) => !open)} /></div>
}
