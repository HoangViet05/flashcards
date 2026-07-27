import { useEffect, useState } from 'react'

const COLD_START_MS = 8000

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return <div className="skeleton" aria-hidden="true">{Array.from({ length: lines }, (_, index) => <i key={index} />)}</div>
}

/**
 * Render ở đúng khung bố cục của nội dung sắp hiện. Render free tier ngủ dậy mất
 * khoảng 30 giây; không nói ra thì người dùng sẽ kết luận app hỏng.
 */
export function LoadingRegion({ label, lines = 3 }: { label: string; lines?: number }) {
  const [cold, setCold] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setCold(true), COLD_START_MS)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <div className="loading-region" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton lines={lines} />
      {cold ? <p className="loading-region__cold">Máy chủ đang thức dậy — lần đầu trong ngày thường mất khoảng nửa phút.</p> : null}
    </div>
  )
}
