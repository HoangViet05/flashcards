import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { answerWeakWord, getWeakWords } from '../api/weak'
import ExerciseCard from '../components/daily/ExerciseCard'
import { useNotification } from '../components/NotificationProvider'
import type { WeakWord } from '../types'

export default function WeakWordsPage() {
  const { toast } = useNotification()
  const [words, setWords] = useState<WeakWord[] | null>(null)
  const [index, setIndex] = useState<number | null>(null)
  const [presented, setPresented] = useState(0)

  useEffect(() => {
    getWeakWords().then(setWords).catch(() => toast('Không tải được danh sách từ yếu', 'error'))
  }, [toast])

  if (!words) return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted">Đang tải…</div>

  if (!words.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-black text-strong-text">Không có từ nào đang yếu</h1>
        <p className="mt-2 text-sm text-muted">Một từ được coi là yếu khi sai ít nhất 2 trong 5 lần ôn gần nhất.</p>
        <Link to="/" className="mt-5 inline-flex min-h-[44px] items-center rounded-xl bg-accent px-6 text-sm font-bold text-white">Về trang chủ</Link>
      </div>
    )
  }

  if (index !== null) {
    const current = words[index]
    const finish = (correct: boolean) => {
      void answerWeakWord(current.card.id, correct)
        .catch(() => toast('Không lưu được kết quả', 'error'))
      setPresented(value => value + 1)
      if (index + 1 < words.length) setIndex(index + 1)
      else setIndex(null)
    }
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="mb-3 text-sm font-medium text-muted">Luyện từ yếu · {index + 1}/{words.length}</p>
        <ExerciseCard key={`${current.card.id}-${presented}`} card={current.card} mode={current.suggested_step} onResult={finish} />
        <button onClick={() => setIndex(null)} className="mt-4 min-h-[44px] text-xs font-bold text-muted underline">Dừng luyện</button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-black text-strong-text">Từ đang yếu</h1>
      <p className="mt-1 text-sm text-muted">{words.length} từ sai ít nhất 2 trong 5 lần ôn gần nhất. Luyện ở đây không làm đổi lịch ôn.</p>
      <button onClick={() => { setIndex(0); setPresented(0) }} className="mt-4 min-h-[44px] rounded-xl bg-accent px-6 text-sm font-bold text-white">Luyện ngay</button>
      <ul className="mt-6 grid gap-2">
        {words.map(item => (
          <li key={item.card.id} className="flex items-center gap-3 rounded-2xl border border-subtle bg-surface-1 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-strong-text">{item.card.front_text}</p>
              <p className="truncate text-xs text-muted">{item.card.back_text}</p>
            </div>
            <span className="shrink-0 rounded-full border border-warn/30 bg-warn/10 px-3 py-1 text-xs font-bold text-warn">sai {item.recent_wrong}/5 lần gần nhất</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
