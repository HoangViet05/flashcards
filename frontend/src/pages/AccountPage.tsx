import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function AccountPage() {
  const { user, loading, logout } = useAuth()

  if (!loading && !user) return <Navigate to="/login" replace />
  if (!user) return null

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <section className="glass rounded-[2rem] border border-white/10 bg-[#0a0a0f]/75 p-6 sm:p-8 shadow-[0_24px_64px_rgba(0,0,0,0.42)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">Tài khoản</p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-white break-words">
              {user.name || user.email}
            </h1>
            <p className="mt-1 text-sm font-medium text-gray-400">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-bold text-red-200 transition hover:bg-red-500/20"
          >
            Đăng xuất
          </button>
        </div>
      </section>
    </main>
  )
}
