import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LoadingRegion } from './Skeleton'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('announces the region while it loads', () => {
  render(<LoadingRegion label="Đang tải tiến độ" lines={3} />)
  expect(screen.getByRole('status')).toHaveTextContent('Đang tải tiến độ')
})

it('explains the free-tier cold start only after eight seconds', () => {
  render(<LoadingRegion label="Đang tải tiến độ" lines={3} />)
  expect(screen.queryByText(/thức dậy/)).not.toBeInTheDocument()
  act(() => { vi.advanceTimersByTime(8000) })
  expect(screen.getByText(/thức dậy/)).toBeInTheDocument()
})
