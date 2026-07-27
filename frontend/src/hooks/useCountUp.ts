import { useEffect, useRef, useState } from 'react'
import { duration, motionDisabled } from '../lib/motion'
import type { DurationToken } from '../lib/motion'

/** Đếm từ giá trị trước lên giá trị mới. Luôn dừng đúng ở giá trị mới. */
export function useCountUp(value: number, token: DurationToken = 'celebrate'): number {
  const [shown, setShown] = useState(() => (motionDisabled() ? value : 0))
  const from = useRef(shown)

  useEffect(() => {
    if (motionDisabled()) { from.current = value; setShown(value); return }
    const start = performance.now()
    const total = duration(token)
    const origin = from.current
    let handle = 0
    const tick = (now: number) => {
      const ratio = Math.min(1, (now - start) / total)
      const eased = 1 - (1 - ratio) ** 3
      setShown(Math.round(origin + (value - origin) * eased))
      if (ratio < 1) handle = requestAnimationFrame(tick)
      else { from.current = value; setShown(value) }
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [token, value])

  return shown
}
