import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { motionDisabled } from '../../lib/motion'

type StartViewTransition = (callback: () => void) => { finished: Promise<void> }

/**
 * View Transitions chạy trên Chrome, Edge và Safari 18+. Firefox chưa hỗ trợ;
 * fallback là fade-in CSS thuần. Đó là hành vi hợp lệ, không phải lỗi.
 */
export default function RouteTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [rendered, setRendered] = useState(children)
  const previous = useRef(pathname)

  useEffect(() => {
    if (previous.current === pathname) { setRendered(children); return }
    previous.current = pathname
    const start = (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition
    if (motionDisabled() || typeof start !== 'function') { setRendered(children); return }
    start.call(document, () => { setRendered(children) })
  }, [pathname, children])

  return <div className="route-transition" key={pathname}>{rendered}</div>
}
