import { Link, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Bộ thẻ', icon: '🗂️' },
  { to: '/review', label: 'Ôn tập', icon: '🧠' },
  { to: '/stats', label: 'Thống kê', icon: '📊' },
]

export default function Navbar() {
  const { pathname } = useLocation()
  return (
    <div className="sticky top-4 z-50 px-4 sm:px-6 max-w-7xl mx-auto mb-6 w-full pointer-events-none">
      <nav className="flex items-center justify-between glass rounded-2xl sm:rounded-[1.5rem] px-3 sm:px-5 py-3 bg-black/50 backdrop-blur-2xl border border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.6)] pointer-events-auto">
        <Link to="/" className="flex items-center gap-3 pl-1 sm:pl-2 group shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-lg sm:text-xl shadow-[0_0_15px_rgba(139,92,246,0.5)] group-hover:shadow-[0_0_25px_rgba(139,92,246,0.6)] group-hover:scale-105 transition-all">
            ⚡
          </div>
          <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 text-lg sm:text-xl tracking-wide hidden sm:block">Flash<span className="text-violet-400">cards</span></span>
        </Link>

        <div className="flex items-center gap-1 p-1.5 bg-white/[0.02] rounded-xl sm:rounded-2xl border border-white/5 shadow-inner">
          {NAV_ITEMS.map(({ to, label, icon }) => {
            const active = pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 whitespace-nowrap ${
                  active
                    ? 'bg-gradient-to-br from-violet-600/40 to-purple-600/30 text-white border border-violet-500/30 shadow-[0_0_20px_rgba(124,58,237,0.2)] scale-[1.02]'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.06] border border-transparent hover:scale-[1.02]'
                }`}
              >
                <span className="text-sm sm:text-base">{icon}</span>
                <span className="tracking-wide">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
