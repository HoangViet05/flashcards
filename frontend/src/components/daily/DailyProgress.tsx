import { useState } from 'react'
import { Link } from 'react-router-dom'

import type { Phase } from '../../hooks/useDailySession'
import { isSoundOn, setSoundOn } from '../../utils/feedbackSound'

interface Props {
  phase: Phase
  stepsDone: number
  stepsTotal: number
  combo: number
}

const PHASE_LABEL: Partial<Record<Phase, string>> = {
  review: 'Ôn tập',
  weak: 'Từ đang yếu',
  speak: 'Nói lại',
  flip: 'Lật thẻ & nghe',
  dictation: 'Nghe & điền',
  split: 'Chia đôi',
  game: 'Ô chữ',
}

export default function DailyProgress({ phase, stepsDone, stepsTotal, combo }: Props) {
  const [sound, setSound] = useState(isSoundOn())

  // Tính theo số bước đã hoàn thành nên trả lời sai (từ bị đẩy xuống cuối hàng)
  // không làm thanh tụt lùi.
  const percent = stepsTotal ? Math.round((stepsDone / stepsTotal) * 100) : 0

  const toggleSound = () => {
    const next = !sound
    setSound(next)
    setSoundOn(next)
  }

  return (
    <div className="mb-6">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <p className="text-sm font-bold text-strong-text">{PHASE_LABEL[phase] ?? 'Học hôm nay'}</p>
        <p className="text-xs font-medium text-muted">{stepsDone}/{stepsTotal} bước</p>
        {combo >= 3 && (
          <span className="rounded-full bg-correct/15 px-2 py-0.5 text-xs font-black text-correct">chuỗi {combo}</span>
        )}

        <div className="flex-1" />

        <button
          onClick={toggleSound}
          className="min-h-[44px] rounded-lg border border-subtle bg-surface-1 px-3 text-xs font-bold text-muted hover:text-body"
        >
          {sound ? 'Tắt tiếng' : 'Bật tiếng'}
        </button>
        <Link
          to="/"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-subtle bg-surface-1 px-3 text-xs font-bold text-muted hover:text-body"
        >
          Tạm dừng
        </Link>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent-2"
          style={{ width: `${percent}%`, transition: 'width var(--dur-base) ease' }}
        />
      </div>
    </div>
  )
}
