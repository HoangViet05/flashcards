import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDailyStatus } from '../api/daily'
import DailyGamePanel from '../components/daily/DailyGamePanel'
import DailyStatusHero from '../components/daily/DailyStatusHero'
import type { DailyStatus } from '../types'

export default function GamesPage() {
  const [status, setStatus] = useState<DailyStatus | null>(null); const [loading, setLoading] = useState(true)
  useEffect(() => { void getDailyStatus().then(setStatus).catch(() => {}).finally(() => setLoading(false)) }, [])
  if (loading) return <div className="flex justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" /></div>
  const state = status?.session_status ?? 'none'
  return <div className="mx-auto max-w-7xl px-4 py-8"><h1 className="mb-6 text-2xl font-black text-white">🎮 Game củng cố từ vựng</h1>
    {state === 'none' && <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-8 text-center"><p className="mb-2 text-3xl">📭</p><p className="mb-4 text-sm text-slate-400">Hôm nay chưa có bài học — tạo thẻ mới để bắt đầu.</p><Link to="/" className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-5 py-2.5 text-sm font-bold text-cyan-200">Về trang chủ</Link></div>}
    {state === 'learning' && <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[.06] p-8 text-center"><p className="mb-2 text-3xl">📚</p><h2 className="mb-2 text-lg font-black text-white">Học bài rồi mới chơi nhé!</h2><p className="mb-5 text-sm text-slate-400">Hoàn thành phần học hôm nay để mở khóa game ô chữ + nối nghĩa.</p><Link to="/daily" className="rounded-xl border border-violet-300/30 bg-violet-500/15 px-6 py-3 text-sm font-black text-violet-200">📖 Học bài ngay</Link></div>}
    {state === 'game' && <DailyGamePanel />}
    {state === 'done' && <DailyStatusHero kind="complete" primaryTo="/daily" primaryLabel="Xem hành trình hôm nay" secondaryTo="/" secondaryLabel="Tạo thêm thẻ" />}
  </div>
}
