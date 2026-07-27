import { useCountUp } from '../../hooks/useCountUp'
import type { ProgressOverview } from '../../types'
import './Stats.css'

const XP_PER_LEVEL = 100
const CIRCUMFERENCE = 2 * Math.PI * 52

export default function MotivationRing({ overview }: { overview: ProgressOverview }) {
  // useCachedQuery phục vụ bản cache trong localStorage trước khi có phản hồi
  // mới. Cache ghi trước khi total_xp/level tồn tại sẽ thiếu hai trường này, và
  // undefined % 100 cho ra NaN trong strokeDashoffset.
  const totalXp = overview.total_xp ?? 0
  const level = overview.level ?? 1
  const xp = useCountUp(totalXp)
  const streak = useCountUp(overview.streak ?? 0)
  const today = useCountUp(overview.study_minutes_today ?? 0)
  const week = useCountUp(overview.study_minutes_week ?? 0)
  const intoLevel = totalXp % XP_PER_LEVEL
  const offset = CIRCUMFERENCE * (1 - intoLevel / XP_PER_LEVEL)

  return (
    <section className="stats-motivation glass-panel enter">
      <div className="stats-motivation__ring">
        <svg aria-hidden="true" viewBox="0 0 120 120">
          <circle className="stats-ring__track" cx="60" cy="60" r="52" />
          <circle className="stats-ring__value" cx="60" cy="60" r="52"
            strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset} />
        </svg>
        <p><strong>{xp}</strong><span>XP</span></p>
      </div>
      <dl className="stats-motivation__facts">
        <div><dt>Level</dt><dd>Level {level}</dd></div>
        <div><dt>Chuỗi ngày</dt><dd>{streak} ngày</dd></div>
        <div><dt>Hôm nay</dt><dd>{today} phút</dd></div>
        <div><dt>Tuần này</dt><dd>{week} phút</dd></div>
      </dl>
    </section>
  )
}
