import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useNotification } from '../components/NotificationProvider'

interface AuthPageProps {
  mode: 'login' | 'register'
}

export default function AuthPage({ mode }: AuthPageProps) {
  const isRegister = mode === 'register'
  const { user, login, register } = useAuth()
  const { toast } = useNotification()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from
  const destination = from
    ? `${from.pathname ?? '/'}${from.search ?? ''}${from.hash ?? ''}`
    : '/'

  if (user) return <Navigate to={destination} replace />

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      if (isRegister) {
        await register(email, password, name.trim() || undefined)
        toast('Đăng ký thành công', 'success')
      } else {
        await login(email, password)
        toast('Đăng nhập thành công', 'success')
      }
      navigate(destination, { replace: true })
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Không thể xử lý yêu cầu'
      toast(message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="grid min-h-[calc(100vh-11rem)] place-items-center">
        <section className="glass w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0a0a0f]/85 p-5 sm:p-7 shadow-[0_28px_70px_rgba(0,0,0,0.45)]">
          <div className="mb-7">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">
              {isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}
            </p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-white">
              {isRegister ? 'Bắt đầu nhận nhắc học' : 'Tiếp tục học bài'}
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {isRegister && (
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-gray-400">Tên hiển thị</span>
                <input
                  value={name}
                  onChange={event => setName(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3.5 font-semibold text-white placeholder-gray-600"
                  placeholder="Nguyễn An"
                />
              </label>
            )}

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-400">Email</span>
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3.5 font-semibold text-white placeholder-gray-600"
                placeholder="ban@example.com"
                required
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-400">Mật khẩu</span>
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3.5 font-semibold text-white placeholder-gray-600"
                placeholder="Tối thiểu 8 ký tự"
                minLength={isRegister ? 8 : undefined}
                required
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary mt-2 rounded-2xl px-6 py-3.5 text-base font-extrabold shadow-[0_0_22px_rgba(124,58,237,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Đang xử lý...' : isRegister ? 'Đăng ký' : 'Đăng nhập'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm font-medium text-gray-400">
            {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
            <Link to={isRegister ? '/login' : '/register'} className="font-bold text-cyan-300 hover:text-cyan-200">
              {isRegister ? 'Đăng nhập' : 'Đăng ký'}
            </Link>
          </p>
        </section>
      </div>
    </main>
  )
}
