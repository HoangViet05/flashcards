import { Link, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Bộ thẻ', icon: '🗂️' },
  { to: '/review', label: 'Ôn tập', icon: '🧠' },
  { to: '/stats', label: 'Thống kê', icon: '📊' },
]

export default function Navbar() {
  const { pathname } = useLocation()
  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 px-6 py-3 flex items-center gap-2"
      style={{ background: 'rgba(8, 8, 16, 0.85)', backdropFilter: 'blur(20px)' }}>
      <Link to="/" className="flex items-center gap-2 mr-6 group">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-sm shadow-lg group-hover:shadow-violet-500/40 transition-shadow">
          ⚡
        </div>
        <span className="font-bold text-white text-base tracking-tight">Flashcards</span>
      </Link>

      <div className="flex items-center gap-1">
        {NAV_ITEMS.map(({ to, label, icon }) => {
          const active = pathname === to
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                  : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              <span className="text-xs">{icon}</span>
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
