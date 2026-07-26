import type { ReactNode } from 'react'

export default function ReadingCompanionDock({ children }: { children: ReactNode }) {
  return <aside className="reading-companion-dock">{children}</aside>
}
