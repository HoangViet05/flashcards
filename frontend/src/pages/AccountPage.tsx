import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { updateReminderSettings } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { useNotification } from '../components/NotificationProvider'

export default function AccountPage() {
  const { user, loading, logout, setUser } = useAuth()
  const { toast } = useNotification()
  const [enabled, setEnabled] = useState(false)
  const [time, setTime] = useState('08:00')
  const [timezone, setTimezone] = useState('Asia/Saigon')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setEnabled(user.reminder_enabled)
    setTime(user.reminder_time)
    setTimezone(user.timezone)
  }, [user])

  if (!loading && !user) return <Navigate to="/login" replace />
  if (!user) return null

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const updated = await updateReminderSettings({
        reminder_enabled: enabled,
        reminder_time: time,
        timezone,
      })
      setUser(updated)
      toast('Đã lưu cài đặt nhắc học', 'success')
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Không thể lưu cài đặt'
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <section className="glass rounded-[2rem] border border-white/10 bg-[#0a0a0f]/75 p-6 sm:p-8 shadow-[0_24px_64px_rgba(0,0,0,0.42)]">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">Tài khoản</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
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

        <form onSubmit={handleSave} className="mt-7 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
            <div>
              <h2 className="text-lg font-extrabold text-white">Email nhắc học hằng ngày</h2>
              <p className="mt-1 text-sm font-medium text-gray-400">
                {enabled ? 'Đang bật' : 'Đang tắt'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(value => !value)}
              className={`relative h-8 w-14 rounded-full border transition ${
                enabled ? 'border-cyan-400/50 bg-cyan-500/40' : 'border-white/10 bg-white/10'
              }`}
              aria-pressed={enabled}
              aria-label="Bật tắt nhắc học"
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
                  enabled ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-400">Giờ gửi</span>
              <input
                type="time"
                value={time}
                onChange={event => setTime(event.target.value)}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3.5 font-semibold text-white"
                disabled={!enabled}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-400">Múi giờ</span>
              <input
                value={timezone}
                onChange={event => setTimezone(event.target.value)}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3.5 font-semibold text-white placeholder-gray-600"
                placeholder="Asia/Saigon"
                disabled={!enabled}
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary rounded-2xl px-7 py-3.5 text-base font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
