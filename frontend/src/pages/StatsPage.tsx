import { useEffect, useState } from 'react'
import { getCalendar, getProgressOverview } from '../api/progress'
import { getWeakWords } from '../api/weak'
import { useAuth } from '../auth/AuthContext'
import DayDetailPanel from '../components/stats/DayDetailPanel'
import DayHeatmap from '../components/stats/DayHeatmap'
import LibraryStrip from '../components/stats/LibraryStrip'
import MotivationRing from '../components/stats/MotivationRing'
import RhythmPanel from '../components/stats/RhythmPanel'
import WeakWordsPanel from '../components/stats/WeakWordsPanel'
import { LoadingRegion } from '../components/shell/Skeleton'
import { useOrbitalShell } from '../components/shell/OrbitalShellContext'
import { useCachedQuery } from '../hooks/useCachedQuery'
import '../components/stats/Stats.css'

export default function StatsPage() {
  const { user } = useAuth()
  const { setHeader } = useOrbitalShell()
  const key = user ? user.id : null
  const overview = useCachedQuery(key && `progress:${key}`, getProgressOverview)
  const calendar = useCachedQuery(key && `progress-calendar:${key}`, () => getCalendar(84))
  const weak = useCachedQuery(key && `progress-weak:${key}`, getWeakWords)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => { setHeader({ eyebrow: 'TIẾN ĐỘ', title: 'Việc học của bạn', streak: overview.data?.streak ?? null }) }, [overview.data, setHeader])

  if (!overview.data || !calendar.data) {
    return <main className="progress-page"><LoadingRegion label="Đang tải tiến độ của bạn" lines={6} /></main>
  }

  const days = calendar.data
  const today = days[days.length - 1]?.date ?? new Date().toISOString().slice(0, 10)
  const active = selected ?? today

  return (
    <main className="progress-page">
      <MotivationRing overview={overview.data} />
      <RhythmPanel days={days} />
      <WeakWordsPanel words={weak.data ?? []} />
      <section className="stats-calendar glass-panel enter">
        <div className="section-heading">
          <h2>84 ngày gần đây</h2>
          <span>{days.filter(day => day.active).length} ngày có học</span>
        </div>
        <div className="stats-calendar__split">
          <DayHeatmap days={days} onSelect={setSelected} selected={active} />
          <DayDetailPanel date={active} />
        </div>
      </section>
      <LibraryStrip overview={overview.data} />
    </main>
  )
}
