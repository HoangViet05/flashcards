import type { CSSProperties, KeyboardEvent } from 'react'
import type { CalendarDay } from '../../types'
import './Stats.css'

const STEP: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }
const FULL_INTENSITY_SECONDS = 900

interface Props { days: CalendarDay[]; selected: string; onSelect: (date: string) => void }

/** Roving tabindex: một ô duy nhất nằm trong luồng Tab, các phím mũi tên di
 *  chuyển lựa chọn. 84 nút cùng vào luồng Tab sẽ khiến bàn phím không dùng nổi. */
export default function DayHeatmap({ days, selected, onSelect }: Props) {
  const index = days.findIndex(day => day.date === selected)

  const move = (event: KeyboardEvent<HTMLOListElement>) => {
    const step = STEP[event.key]
    if (!step || index < 0) return
    event.preventDefault()
    const next = days[Math.max(0, Math.min(days.length - 1, index + step))]
    if (next) onSelect(next.date)
  }

  return (
    <ol className="stats-heatmap" onKeyDown={move}>
      {days.map(day => {
        const minutes = Math.round(day.seconds / 60)
        const intensity = day.seconds ? Math.max(.25, Math.min(1, day.seconds / FULL_INTENSITY_SECONDS)) : 0
        return (
          <li key={day.date}>
            <button
              aria-label={`${day.date} — ${minutes} phút`}
              aria-pressed={day.date === selected}
              className={day.date === selected ? 'is-selected' : undefined}
              onClick={() => onSelect(day.date)}
              style={intensity ? { '--cell-intensity': String(intensity) } as CSSProperties : undefined}
              tabIndex={day.date === selected ? 0 : -1}
              type="button"
            />
          </li>
        )
      })}
    </ol>
  )
}
