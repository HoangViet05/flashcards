import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: 'Bộ thẻ', icon: '🗂️' },
  { to: '/documents', label: 'Tài liệu', icon: '📄', soon: true },
  { to: '/review', label: 'Ôn tập', icon: '🧠' },
  { to: '/stats', label: 'Thống kê', icon: '📊' },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()

  return (
    <div className="sticky top-0 sm:top-4 z-50 px-3 pt-3 sm:px-6 sm:pt-0 max-w-7xl mx-auto mb-4 sm:mb-6 w-full pointer-events-none">
      <nav className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 glass rounded-2xl sm:rounded-[1.5rem] px-3 sm:px-5 py-3 bg-black/60 backdrop-blur-2xl border border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.6)] pointer-events-auto">
        <div className="flex items-center justify-between gap-3 sm:contents">
        <Link to="/" className="flex items-center gap-3 pl-1 sm:pl-2 group shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-lg sm:text-xl shadow-[0_0_15px_rgba(139,92,246,0.5)] group-hover:shadow-[0_0_25px_rgba(139,92,246,0.6)] group-hover:scale-105 transition-all">
            ⚡
          </div>
          <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 text-lg sm:text-xl tracking-wide">
            Flash<span className="text-violet-400">cards</span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:order-3">
          {user ? (
            <>
              <Link
                to="/account"
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  pathname === '/account'
                    ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-100'
                    : 'border-white/10 bg-white/[0.03] text-gray-300 hover:bg-white/[0.07] hover:text-white'
                }`}
              >
                <span>✉️</span>
                <span className="hidden md:inline max-w-[9rem] truncate">{user.name || user.email}</span>
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-gray-400 transition hover:bg-white/[0.07] hover:text-white"
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-gray-300 transition hover:bg-white/[0.07] hover:text-white"
              >
                Đăng nhập
              </Link>
              <Link
                to="/register"
                className="btn-primary rounded-xl px-3 py-2 text-xs font-bold"
              >
                Đăng ký
              </Link>
            </>
          )}
        </div>
        </div>

        <div className="grid grid-cols-4 sm:flex min-w-0 sm:flex-1 items-stretch sm:items-center justify-center gap-1 p-1.5 bg-white/[0.02] rounded-xl sm:rounded-2xl border border-white/5 shadow-inner">
          {NAV_ITEMS.map(({ to, label, icon, soon }) => {
            const active = pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`min-w-0 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-5 py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-bold transition-all duration-300 ${
                  active
                    ? 'bg-gradient-to-br from-violet-600/40 to-purple-600/30 text-white border border-violet-500/30 shadow-[0_0_20px_rgba(124,58,237,0.2)] scale-[1.02]'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.06] border border-transparent hover:scale-[1.02]'
                }`}
              >
                <span className="text-sm sm:text-base">{icon}</span>
                <span className="tracking-wide leading-tight text-center truncate max-w-full">{label}</span>
                {soon && (
                  <span className="hidden sm:inline text-[8px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-1.5 py-0.5">soon</span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
