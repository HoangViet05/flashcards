import { useEffect, useState } from 'react'
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
    {state === 'none' && <DailyStatusHero kind="start" primaryTo="/" primaryLabel="Tạo thẻ để bắt đầu" secondaryTo="/reader" secondaryLabel="Mở Tech Reader" />}
    {state === 'learning' && <DailyStatusHero kind="locked" primaryTo="/daily" primaryLabel="Học bài ngay" secondaryTo="/" secondaryLabel="Về trang chủ" />}
    {state === 'game' && <DailyGamePanel />}
    {state === 'done' && <DailyStatusHero kind="complete" primaryTo="/daily" primaryLabel="Xem hành trình hôm nay" secondaryTo="/" secondaryLabel="Tạo thêm thẻ" />}
  </div>
}
