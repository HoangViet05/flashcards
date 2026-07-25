import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { getDailyHome } from '../../api/daily'
import type { useDailySession } from '../../hooks/useDailySession'
import type { DailyHome, DailyWord } from '../../types'

interface Props {
  daily: ReturnType<typeof useDailySession>
  onContinue: () => void
}

/** Tỉ lệ đúng ngay lần đầu: mỗi bước đã xong là một lần đúng, mỗi lần sai là một lượt thêm. */
function accuracy(words: DailyWord[]) {
  const attempts = words.reduce((sum, word) => sum + word.steps_done.length + word.wrong_count, 0)
  const firstTry = words.reduce((sum, word) => sum + word.steps_done.length, 0)
  return attempts ? Math.round((firstTry / attempts) * 100) : 100
}

export default function DailySummary({ daily, onContinue }: Props) {
  const [home, setHome] = useState<DailyHome | null>(null)

  const words = daily.session?.words ?? []
  const minutes = Math.max(1, Math.round((Date.now() - daily.startedAt) / 60000))
  const weakest = [...words]
    .filter(word => word.wrong_count > 0)
    .sort((a, b) => b.wrong_count - a.wrong_count)
    .slice(0, 5)

  useEffect(() => {
    // Gọi lại /home để lấy chuỗi ngày và số từ đã thuộc sau khi phiên vừa ghi SM-2.
    getDailyHome().then(setHome).catch(() => setHome(null))
  }, [])

  const stats: [string, string][] = [
    ['Từ đã học', String(words.length)],
    ['Độ chính xác', `${accuracy(words)}%`],
    ['Thời gian', `${minutes} phút`],
    ['Chuỗi ngày', home ? `${home.streak} ngày` : '…'],
  ]

  return (
    <section className="mx-auto max-w-3xl rounded-[1.5rem] border border-subtle bg-surface-1 p-6 sm:p-8">
      <p className="text-4xl" aria-hidden="true">🎉</p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-strong-text">Xong phần học hôm nay</h2>
      <p className="mt-1 text-sm font-medium text-muted">
        {home ? `Đã thuộc ${home.mastered_cards}/${home.total_cards} từ.` : 'Đang cập nhật tiến độ…'}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-subtle bg-surface-2 p-4">
            <dt className="text-xs font-black uppercase tracking-wider text-muted">{label}</dt>
            <dd className="mt-1 text-xl font-black text-strong-text">{value}</dd>
          </div>
        ))}
      </dl>

      {weakest.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-black uppercase tracking-wider text-muted">Cần để ý</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {weakest.map(word => (
              <li
                key={word.card_id}
                className="rounded-full border border-warn/30 bg-warn/10 px-3 py-1 text-sm font-bold text-warn"
              >
                {word.card.front_text} · sai {word.wrong_count} lần
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-7 flex flex-wrap gap-3">
        <button onClick={onContinue} className="min-h-[44px] rounded-xl bg-accent px-6 text-sm font-bold text-white">
          Chơi ô chữ
        </button>
        <Link
          to="/"
          className="min-h-[44px] rounded-xl border border-subtle bg-surface-2 px-6 py-3 text-sm font-bold text-body"
        >
          Về trang chủ
        </Link>
      </div>
    </section>
  )
}
