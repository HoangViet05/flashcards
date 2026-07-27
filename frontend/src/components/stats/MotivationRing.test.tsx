import { render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import MotivationRing from './MotivationRing'
import type { ProgressOverview } from '../../types'

const overview = { total_xp: 248, level: 3, streak: 6, study_minutes_today: 18, study_minutes_week: 96 } as ProgressOverview

afterEach(() => { document.documentElement.dataset.reduceEffects = 'false' })

it('shows the combined level and the streak', () => {
  document.documentElement.dataset.reduceEffects = 'true'
  render(<MotivationRing overview={overview} />)
  expect(screen.getByText('Level 3')).toBeInTheDocument()
  expect(screen.getByText('248')).toBeInTheDocument()
  expect(screen.getByText('6 ngày')).toBeInTheDocument()
  expect(screen.getByText('18 phút')).toBeInTheDocument()
})

it('survives a cached response written before total_xp existed', () => {
  document.documentElement.dataset.reduceEffects = 'true'
  const legacy = { streak: 2, study_minutes_today: 5, study_minutes_week: 20 } as ProgressOverview
  const { container } = render(<MotivationRing overview={legacy} />)
  const arc = container.querySelector('.stats-ring__value')!
  expect(arc.getAttribute('stroke-dashoffset')).not.toContain('NaN')
  expect(screen.getByText('Level 1')).toBeInTheDocument()
})
