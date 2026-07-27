import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import RhythmPanel from './RhythmPanel'
import type { CalendarDay } from '../../types'

/** `activeWeekdays` dùng chỉ số 0 = Thứ Hai … 6 = Chủ nhật. */
function build(activeWeekdays: number[]): CalendarDay[] {
  return Array.from({ length: 84 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 4, 4) + index * 86_400_000)
    const weekday = (date.getUTCDay() + 6) % 7
    const active = activeWeekdays.includes(weekday)
    return { date: date.toISOString().slice(0, 10), seconds: active ? 600 : 0, reviews: 0, active }
  })
}

it('names the weekday the learner keeps skipping', () => {
  render(<RhythmPanel days={build([0, 1, 2, 3, 4, 6])} />)
  expect(screen.getByText('Bạn hay bỏ Thứ Bảy.')).toBeInTheDocument()
})

it('says nothing accusatory when every weekday is even', () => {
  render(<RhythmPanel days={build([0, 1, 2, 3, 4, 5, 6])} />)
  expect(screen.queryByText(/hay bỏ/)).not.toBeInTheDocument()
  expect(screen.getByText(/học đều/)).toBeInTheDocument()
})

it('warns that the streak is at risk when today is still empty', () => {
  const days = build([0, 1, 2, 3, 4, 5, 6])
  days[days.length - 1] = { ...days[days.length - 1], active: false, seconds: 0 }
  render(<RhythmPanel days={days} />)
  expect(screen.getByText(/chưa học/)).toBeInTheDocument()
})
