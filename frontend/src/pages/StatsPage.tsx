import { getStats } from '../api/review'
import { useAuth } from '../auth/AuthContext'
import { useCachedQuery } from '../hooks/useCachedQuery'

export default function StatsPage() {
  const { user } = useAuth()
  const statsQuery = useCachedQuery(user ? `stats:${user.id}` : null, getStats)
  const stats = statsQuery.data

  if (!stats) return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-12" aria-label="Đang tải thống kê">
      <div className="mb-8 h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-[1.5rem] border border-white/10 bg-white/[0.04]" />
        ))}
      </div>
    </div>
  )

  const upcomingEntries = Object.entries(stats.due_upcoming).sort()
  const maxUpcoming = Math.max(...upcomingEntries.map(([, v]) => v), 1)

  const STAT_CARDS = [
    { label: 'Chuỗi ngày học', value: stats.streak, icon: '🔥', color: 'from-orange-500/20 to-red-500/10', border: 'border-orange-500/30', text: 'text-orange-400' },
    { label: 'Tổng thẻ', value: stats.total_cards, icon: '🃏', color: 'from-violet-500/20 to-purple-500/10', border: 'border-violet-500/30', text: 'text-violet-400' },
    { label: 'Ôn hôm nay', value: stats.total_reviewed_today, icon: '✅', color: 'from-emerald-500/20 to-teal-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
    { label: 'Cần ôn ngay', value: stats.due_today, icon: '⏰', color: 'from-cyan-500/20 to-blue-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400' },
    { label: 'Từ mới chờ học', value: stats.new_cards, icon: '✨', color: 'from-amber-500/20 to-yellow-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-12 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3 -z-10" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none translate-y-1/3 -translate-x-1/3 -z-10" />

      <div className="mb-8 sm:mb-10 animate-fade-in-up flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight">Thống kê học tập</h1>
          <p className="text-gray-500 text-sm mt-2 font-medium">Theo dõi tiến độ và thành tích của bạn</p>
        </div>
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[1.25rem] bg-gradient-to-br from-white/5 to-white/10 border border-white/10 flex items-center justify-center text-2xl sm:text-3xl shadow-inner backdrop-blur-md shrink-0">
          📊
        </div>
      </div>

      {/* Streak visual */}
      {stats.streak > 0 && (
        <div className="mb-8 relative rounded-[2rem] p-[1px] animate-fade-in-up" style={{ animationDelay: '60ms', boxShadow: '0 20px 40px -15px rgba(251,146,60,0.2)' }}>
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/50 via-red-500/40 to-pink-500/40 opacity-80 blur-md pointer-events-none rounded-[2rem]" />
          <div className="relative glass rounded-[2rem] p-5 sm:p-6 flex items-start sm:items-center gap-4 sm:gap-6 overflow-hidden bg-black/40 backdrop-blur-xl border border-white/10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[1.25rem] bg-gradient-to-br from-orange-500/20 to-red-500/30 border border-orange-500/40 flex items-center justify-center text-3xl sm:text-4xl shadow-[0_0_20px_rgba(249,115,22,0.3)] shrink-0 animate-pulse-glow">
              🔥
            </div>
            <div>
              <p className="text-white font-extrabold text-2xl tracking-tight drop-shadow-sm">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">{stats.streak} ngày</span> liên tiếp!
              </p>
              <p className="text-gray-400 text-sm mt-1 font-medium">Quá đỉnh! Hãy tiếp tục duy trì thói quen học mỗi ngày nhé.</p>
            </div>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-10">
        {STAT_CARDS.map((s, i) => (
          <div
            key={s.label}
            className={`group relative rounded-[1.5rem] p-[1px] overflow-hidden animate-fade-in-up`}
            style={{ animationDelay: `${(i * 60) + 120}ms` }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-80 pointer-events-none transition-opacity duration-300 group-hover:opacity-100`} />
            <div className={`relative h-full glass rounded-[1.5rem] p-5 sm:p-6 flex items-center gap-4 sm:gap-5 bg-black/40 backdrop-blur-xl border ${s.border} transition-transform duration-300 group-hover:scale-[1.02]`}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none -translate-y-1/2 translate-x-1/2 group-hover:bg-white/10 transition-colors" />
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl sm:text-3xl shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-300">
                {s.icon}
              </div>
              <div>
                <p className={`text-2xl sm:text-3xl font-black ${s.text} tracking-tight drop-shadow-md`}>{s.value}</p>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mt-1">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming chart */}
      <div className="relative rounded-[2rem] p-[1px] animate-fade-in-up overflow-hidden" style={{ animationDelay: '360ms' }}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-[2rem] pointer-events-none" />
        <div className="relative glass rounded-[2rem] p-6 sm:p-8 bg-black/20 backdrop-blur-xl border border-white/10">
          <h2 className="text-white font-bold mb-6 flex items-center gap-3 text-lg tracking-tight">
            <span className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-lg shadow-inner">📅</span>
            Lịch ôn tập sắp tới (7 ngày)
          </h2>
          <div className="flex flex-col gap-4">
            {upcomingEntries.map(([d, count]) => {
              const pct = Math.round((count / maxUpcoming) * 100)
              const dateObj = new Date(d)
              const label = dateObj.toLocaleDateString('vi-VN', { weekday: 'short', month: 'numeric', day: 'numeric' })
              return (
                <div key={d} className="flex items-center gap-3 sm:gap-4 group">
                  <span className="text-gray-400 text-xs sm:text-sm font-medium w-20 sm:w-24 shrink-0 group-hover:text-gray-300 transition-colors">{label}</span>
                  <div className="flex-1 h-3 bg-white/[0.03] rounded-full overflow-hidden border border-white/5 shadow-inner">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out relative"
                      style={{
                        width: `${pct}%`,
                        background: 'linear-gradient(90deg, #7c3aed, #06b6d4)',
                      }}
                    >
                      <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent to-white/20" />
                    </div>
                  </div>
                  <span className="text-white text-sm w-8 text-right font-bold bg-white/5 px-2 py-1 rounded-lg border border-white/10">{count}</span>
                </div>
              )
            })}
            {upcomingEntries.every(([, v]) => v === 0) && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-3xl mx-auto mb-4 border border-white/10">🎉</div>
                <p className="text-gray-400 font-medium">Bạn đã hoàn thành rất tốt, không có thẻ nào sắp đến hạn!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
