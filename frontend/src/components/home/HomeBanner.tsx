import { Link } from 'react-router-dom'
import type { DailyHome } from '../../types'
export default function HomeBanner({ home }: { home: DailyHome }) {
  if (home.streak > 0 && !home.studied_today) return <div className="mb-4 rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm font-bold text-warn">Sắp mất chuỗi {home.streak} ngày — học hôm nay để giữ chuỗi.</div>
  if (home.low_new_words) return <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3"><p className="text-sm font-bold text-warn">Sắp hết từ mới (còn {home.new_remaining}).</p><Link to="/reader" className="text-sm font-bold text-accent-2 underline">Đọc bài để lưu thêm từ</Link></div>
  return null
}
