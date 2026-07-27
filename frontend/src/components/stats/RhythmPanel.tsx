import { useMemo } from 'react'
import type { CalendarDay } from '../../types'
import './Stats.css'

const LABELS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
const SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const WINDOW = 56
const WEAK_RATIO = .5

function weekdayIndex(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7
}

/** Nhận dãy 84 ngày và chỉ dùng 56 ngày cuối — 8 tuần là đủ để thấy thói quen
 *  mà không bị nhịp của hai tháng trước làm loãng. */
export default function RhythmPanel({ days }: { days: CalendarDay[] }) {
  const recent = useMemo(() => days.slice(-WINDOW), [days])

  const ratios = useMemo(() => LABELS.map((_, weekday) => {
    const matching = recent.filter(day => weekdayIndex(day.date) === weekday)
    if (!matching.length) return 0
    return matching.filter(day => day.active).length / matching.length
  }), [recent])

  const gap = useMemo(() => {
    const activeDays = recent.filter(day => day.active).map(day => Date.parse(`${day.date}T00:00:00Z`))
    if (activeDays.length < 2) return null
    const total = activeDays[activeDays.length - 1] - activeDays[0]
    return Math.round((total / (activeDays.length - 1)) / 86_400_000 * 10) / 10
  }, [recent])

  const weakest = ratios.indexOf(Math.min(...ratios))
  const studiedToday = recent[recent.length - 1]?.active ?? false

  return (
    <section className="stats-rhythm glass-panel enter">
      <div className="section-heading"><h2>Nhịp học</h2><span>8 tuần gần đây</span></div>
      <ol className="stats-rhythm__bars">
        {ratios.map((ratio, index) => (
          <li className="hint" key={LABELS[index]}>
            <i style={{ blockSize: `${Math.max(4, Math.round(ratio * 100))}%` }} />
            <span>{SHORT[index]}</span>
            <b data-tip>{LABELS[index]}: {Math.round(ratio * 100)}% số tuần có học</b>
          </li>
        ))}
      </ol>
      <p>{ratios[weakest] < WEAK_RATIO ? `Bạn hay bỏ ${LABELS[weakest]}.` : 'Bạn học đều cả bảy ngày.'}</p>
      <p>{gap === null ? 'Chưa đủ dữ liệu để đo khoảng cách giữa các buổi.' : `Trung bình ${gap} ngày giữa hai buổi.`}</p>
      <p>{studiedToday ? 'Hôm nay đã học — chuỗi được giữ.' : 'Hôm nay chưa học. Chuỗi sẽ đứt vào nửa đêm.'}</p>
    </section>
  )
}
