import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useCountUp } from './useCountUp'

function Probe({ value }: { value: number }) { return <span>{useCountUp(value)}</span> }

beforeEach(() => {
  vi.useFakeTimers()
  let now = 0
  vi.stubGlobal('performance', { now: () => now })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    Number(setTimeout(() => { now += 16; callback(now) }, 16)))
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => clearTimeout(handle))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('lands exactly on the target value', () => {
  render(<Probe value={248} />)
  act(() => { vi.advanceTimersByTime(2000) })
  expect(screen.getByText('248')).toBeInTheDocument()
})

it('shows the target immediately when motion is disabled', () => {
  document.documentElement.dataset.reduceEffects = 'true'
  render(<Probe value={99} />)
  expect(screen.getByText('99')).toBeInTheDocument()
  document.documentElement.dataset.reduceEffects = 'false'
})
