import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { getDailyHome } from '../api/daily'
import { getWorkerHealth } from '../api/shadowingWorker'
import { getWeakWords } from '../api/weak'
import { useAuth } from '../auth/AuthContext'
import HomeBanner from '../components/home/HomeBanner'
import HomeEmptyGuide from '../components/home/HomeEmptyGuide'
import HomeHero from '../components/home/HomeHero'
import HomeSideTiles from '../components/home/HomeSideTiles'
import { useCachedQuery } from '../hooks/useCachedQuery'

export default function HomePage() {
  const { user } = useAuth()
  const homeQuery = useCachedQuery(user ? `daily-home:${user.id}` : null, getDailyHome)
  const weakQuery = useCachedQuery(user ? `weak:${user.id}` : null, getWeakWords)
  const [workerOnline, setWorkerOnline] = useState<boolean | null>(null)

  useEffect(() => {
    // Dò máy chấm tách khỏi luồng tải chính: nó nằm ở máy khác và có thể đang tắt.
    let alive = true
    getWorkerHealth()
      .then(health => { if (alive) setWorkerOnline(health.model_loaded) })
      .catch(() => { if (alive) setWorkerOnline(false) })
    return () => { alive = false }
  }, [])

  const home = homeQuery.data

  if (homeQuery.loading && !home) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="h-44 animate-pulse rounded-[1.5rem] border border-subtle bg-surface-1" />
      </div>
    )
  }

  if (!home) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm font-medium text-muted sm:px-6">
        Không tải được dữ liệu hôm nay.{' '}
        <button onClick={() => void homeQuery.refresh()} className="font-bold text-accent-2 underline">
          Thử lại
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <HomeBanner home={home} />

      {home.total_cards === 0 ? (
        <HomeEmptyGuide />
      ) : (
        <>
          <HomeHero home={home} />
          <HomeSideTiles article={home.latest_article} workerOnline={workerOnline} weakCount={weakQuery.data?.length ?? 0} />
          <p className="mt-5 text-xs font-medium text-muted">
            Đã thuộc {home.mastered_cards}/{home.total_cards} từ · {home.deck_count} bộ thẻ ·{' '}
            <Link to="/library" className="font-bold text-accent-2 underline">quản lý bộ thẻ</Link>
          </p>
        </>
      )}
    </div>
  )
}
