import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: 'Học hôm nay', icon: 'review', soon: false },
  { to: '/reader', label: 'Đọc', icon: 'book', soon: false },
  { to: '/shadowing', label: 'Nói', icon: 'mic', soon: false },
  { to: '/library', label: 'Thư viện', icon: 'deck', soon: false },
] as const

type NavIconName = (typeof NAV_ITEMS)[number]['icon'] | 'mail' | 'login' | 'logout' | 'chart'

function NavIcon({ name, className = '' }: { name: NavIconName; className?: string }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (name) {
    case 'deck':
      return (
        <svg {...common}>
          <path d="M5 7.5h14" />
          <path d="M7 4.5h10a2 2 0 0 1 2 2v10.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z" />
          <path d="M8 11h8M8 14.5h5" />
        </svg>
      )
    case 'review':
      return (
        <svg {...common}>
          <path d="M12 5.5a6.5 6.5 0 1 0 6.5 6.5" />
          <path d="M18.5 5.5v5h-5" />
          <path d="M18.2 10.5A6.5 6.5 0 0 0 12 5.5" />
          <path d="M9.5 12.2 11.2 14l3.5-4" />
        </svg>
      )
    case 'book':
      return (
        <svg {...common}>
          <path d="M4.5 5.5A2.5 2.5 0 0 1 7 3h11v16H7a2.5 2.5 0 0 0-2.5 2.5Z" />
          <path d="M7 3v16" />
          <path d="M10 7h5M10 10h5" />
        </svg>
      )
    case 'chart': return <svg {...common}><path d="M4.5 19.5h15" /><path d="M7 16.5v-5M12 16.5v-9M17 16.5v-3" /></svg>
    case 'mic':
      return <svg {...common}><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" /><path d="M12 18v3" /></svg>
    case 'mail':
      return (
        <svg {...common}>
          <path d="M4.5 6.5h15v11h-15z" />
          <path d="m5 7 7 5.5L19 7" />
        </svg>
      )
    case 'login':
      return (
        <svg {...common}>
          <path d="M9.5 7.5 14 12l-4.5 4.5" />
          <path d="M14 12H3.5" />
          <path d="M14.5 4.5h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-4" />
        </svg>
      )
    case 'logout':
      return (
        <svg {...common}>
          <path d="M14.5 7.5 19 12l-4.5 4.5" />
          <path d="M19 12H8.5" />
          <path d="M9.5 4.5h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h4" />
        </svg>
      )
  }
}

function isRouteActive(pathname: string, to: string) {
  if (to === '/') {
    return pathname === '/'
  }
  if (to === '/library') return pathname === '/library' || pathname.startsWith('/decks')

  return pathname === to || pathname.startsWith(`${to}/`)
}

export default function Navbar() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()

  return (
    <div className="sticky top-0 sm:top-4 z-50 mx-auto mb-4 w-full max-w-7xl px-3 pt-3 sm:mb-7 sm:px-6 sm:pt-0 pointer-events-none">
      <nav className="pointer-events-auto overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#0b0d16]/85 shadow-[0_18px_55px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.03] backdrop-blur-2xl">
        <div className="flex flex-col gap-3 p-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center justify-between gap-3 sm:contents">
            <Link to="/" className="group flex shrink-0 items-center gap-2.5 rounded-2xl px-1.5 py-1.5 transition hover:bg-white/[0.04] sm:gap-3 sm:px-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[0.85rem] border border-white/15 bg-[linear-gradient(135deg,#7c3aed,#06b6d4)] text-sm font-black text-white shadow-[0_10px_25px_rgba(6,182,212,0.18)] transition group-hover:scale-105 group-hover:shadow-[0_14px_34px_rgba(124,58,237,0.28)] sm:h-10 sm:w-10 sm:rounded-[0.9rem] sm:text-base">
                F
              </div>
              <span className="text-lg font-black tracking-normal text-white sm:text-[1.35rem]">
                Flash<span className="text-cyan-300">cards</span>
              </span>
            </Link>

            <div className="flex shrink-0 items-center gap-1.5 sm:order-3">
              {user ? (
                <>
                  <Link to="/stats" title="Tiến độ" className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition ${pathname === '/stats' ? 'border-cyan-300/35 bg-cyan-300/12 text-cyan-100' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/18 hover:bg-white/[0.07] hover:text-white'}`}><NavIcon name="chart" className="h-4 w-4" /><span className="hidden lg:inline">Tiến độ</span></Link>
                  <Link
                    to="/account"
                    className={`flex h-10 max-w-[11rem] items-center gap-2 rounded-xl border px-3 text-xs font-bold transition ${
                      pathname === '/account'
                        ? 'border-cyan-300/35 bg-cyan-300/12 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.12)]'
                        : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/18 hover:bg-white/[0.07] hover:text-white'
                    }`}
                    title={user.name || user.email}
                  >
                    <NavIcon name="mail" className="h-4 w-4 shrink-0" />
                    <span className="hidden truncate md:inline">{user.name || user.email}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-slate-400 transition hover:border-white/18 hover:bg-white/[0.07] hover:text-white"
                  >
                    <NavIcon name="logout" className="h-4 w-4" />
                    <span className="hidden lg:inline">Đăng xuất</span>
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-slate-300 transition hover:border-white/18 hover:bg-white/[0.07] hover:text-white"
                    aria-label="Đăng nhập"
                  >
                    <NavIcon name="login" className="h-4 w-4" />
                    <span className="hidden sm:inline">Đăng nhập</span>
                  </Link>
                  <Link
                    to="/register"
                    className="hidden h-10 items-center rounded-xl border border-violet-400/40 bg-violet-500/80 px-3 text-xs font-bold text-white shadow-[0_10px_24px_rgba(124,58,237,0.25)] transition hover:bg-violet-400 min-[360px]:flex"
                  >
                    Đăng ký
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-4 items-center gap-1 rounded-2xl border border-white/[0.07] bg-black/20 p-1 shadow-inner shadow-black/30 sm:flex sm:flex-1 sm:justify-center">
          {NAV_ITEMS.map(({ to, label, icon, soon }) => {
            const active = isRouteActive(pathname, to)
            return (
              <Link
                key={to}
                to={to}
                className={`group relative flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] font-bold transition duration-200 sm:h-10 sm:min-w-[7.25rem] sm:flex-row sm:gap-2 sm:px-4 sm:text-sm ${
                  active
                    ? 'border border-cyan-300/25 bg-white/[0.09] text-white shadow-[0_8px_24px_rgba(6,182,212,0.12)]'
                    : 'border border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'
                }`}
              >
                <NavIcon className={`h-4.5 w-4.5 shrink-0 ${active ? 'text-cyan-300' : 'text-slate-500 group-hover:text-slate-200'}`} name={icon} />
                <span className="max-w-full truncate text-center leading-tight">{label}</span>
                {soon && (
                  <span className="hidden rounded-full border border-amber-300/25 bg-amber-300/12 px-1.5 py-0.5 text-[8px] font-black uppercase leading-none text-amber-200 sm:inline">soon</span>
                )}
              </Link>
            )
          })}
          </div>
        </div>
      </nav>
    </div>
  )
}
