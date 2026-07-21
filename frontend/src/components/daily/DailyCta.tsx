import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDailyStatus } from '../../api/daily'
import type { DailyStatus } from '../../types'

const text: Record<DailyStatus['session_status'], string> = { none: 'Bắt đầu học hôm nay', learning: 'Tiếp tục học hôm nay', game: 'Chơi game củng cố từ vựng', done: 'Hôm nay đã hoàn thành 🎉' }
export default function DailyCta() {
  const [status, setStatus] = useState<DailyStatus | null>(null)
  useEffect(() => { void getDailyStatus().then(setStatus).catch(() => {}) }, [])
  if (!status) return null
  return <div className="mb-8"><Link to={status.session_status === 'game' ? '/games' : '/daily'} className="flex items-center justify-between rounded-2xl border border-violet-400/30 bg-gradient-to-r from-violet-600/20 to-cyan-500/15 p-5 hover:border-violet-300/50"><span><span className="block text-lg font-black text-white">📚 {text[status.session_status]}</span><span className="mt-1 block text-sm text-slate-400">{status.session_status === 'none' || status.session_status === 'learning' ? `${status.new_count || 10} từ mới · ${status.due_count} từ cần ôn` : 'Giữ vững chuỗi học mỗi ngày nhé'}</span></span><span className="text-2xl">→</span></Link>{status.low_new_words && <div className="mt-3 flex items-center justify-between rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4"><p className="text-sm text-amber-200">⚠️ Sắp hết từ mới (còn {status.new_remaining} từ) — tạo thêm thẻ hoặc bộ thẻ mới để không gián đoạn.</p><Link to="/" className="ml-3 shrink-0 rounded-xl border border-amber-300/40 bg-amber-400/15 px-4 py-2 text-xs font-bold text-amber-100">Tạo thẻ mới</Link></div>}</div>
}
