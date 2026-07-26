import { useEffect, useMemo } from 'react'
import { getDailyHome } from '../api/daily'
import { useAuth } from '../auth/AuthContext'
import TodayOrbitalCommand from '../components/home/TodayOrbitalCommand'
import { toTodayOrbitalData } from '../components/home/todayOrbitalData'
import type { TodayVisualState } from '../components/home/todayOrbitalData'
import { useOrbitalShell } from '../components/shell/OrbitalShellContext'
import { useCachedQuery } from '../hooks/useCachedQuery'

/** Production Today maps only DailyHome responses or previous successful cached responses. */
export default function HomePage() {
  const { user } = useAuth()
  const { setHeader } = useOrbitalShell()
  const query = useCachedQuery(user ? `today-orbital:${user.id}` : null, getDailyHome)
  const data = useMemo(
    () => query.data ? toTodayOrbitalData(query.data, user, !query.error) : null,
    [query.data, query.error, user],
  )
  const state: TodayVisualState = query.error
    ? data ? 'slow-cached' : 'offline-error'
    : !data ? 'slow-cached'
      : data.wordsReady === 0 && data.rememberedCards === 0 ? 'empty-new-user' : 'loaded'

  useEffect(() => {
    setHeader(data ? { eyebrow: data.date, title: data.greeting, streak: data.streak } : { eyebrow: 'LEARNING OS', title: 'Today', streak: null })
  }, [data, setHeader])

  return <TodayOrbitalCommand data={data} state={state} onRetry={() => void query.refresh()} />
}
