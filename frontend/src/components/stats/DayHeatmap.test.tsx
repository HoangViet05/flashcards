import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import DayHeatmap from './DayHeatmap'
import type { CalendarDay } from '../../types'

const days: CalendarDay[] = Array.from({ length: 84 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 4, 4) + index * 86_400_000).toISOString().slice(0, 10)
  return { date, seconds: index % 3 === 0 ? 900 : 0, reviews: 0, active: index % 3 === 0 }
})

it('exposes every day as a button a keyboard can reach', () => {
  render(<DayHeatmap days={days} onSelect={() => undefined} selected={days[10].date} />)
  expect(screen.getAllByRole('button')).toHaveLength(84)
  expect(screen.getByRole('button', { name: new RegExp(days[10].date) })).toHaveAttribute('tabindex', '0')
  expect(screen.getByRole('button', { name: new RegExp(days[11].date) })).toHaveAttribute('tabindex', '-1')
})

it('moves the selection one day with the right arrow', async () => {
  const onSelect = vi.fn()
  render(<DayHeatmap days={days} onSelect={onSelect} selected={days[10].date} />)
  screen.getByRole('button', { name: new RegExp(days[10].date) }).focus()
  await userEvent.keyboard('{ArrowRight}')
  expect(onSelect).toHaveBeenCalledWith(days[11].date)
})

it('moves a whole week with the down arrow', async () => {
  const onSelect = vi.fn()
  render(<DayHeatmap days={days} onSelect={onSelect} selected={days[10].date} />)
  screen.getByRole('button', { name: new RegExp(days[10].date) }).focus()
  await userEvent.keyboard('{ArrowDown}')
  expect(onSelect).toHaveBeenCalledWith(days[17].date)
})

it('does not run past either end of the window', async () => {
  const onSelect = vi.fn()
  render(<DayHeatmap days={days} onSelect={onSelect} selected={days[0].date} />)
  screen.getByRole('button', { name: new RegExp(days[0].date) }).focus()
  await userEvent.keyboard('{ArrowLeft}')
  expect(onSelect).toHaveBeenCalledWith(days[0].date)
})

it('names the minutes in the accessible label', () => {
  render(<DayHeatmap days={days} onSelect={() => undefined} selected={days[0].date} />)
  expect(screen.getByRole('button', { name: new RegExp(`${days[0].date}.*15 phút`) })).toBeInTheDocument()
})
