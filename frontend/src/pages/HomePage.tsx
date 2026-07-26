import { useEffect, useMemo } from 'react'
import { getDailyHome } from '../api/daily'
import { useAuth } from '../auth/AuthContext'
import TodayOrbitalCommand from '../components/home/TodayOrbitalCommand'
import { toTodayOrbitalData } from '../components/home/todayOrbitalData'
import type { TodayVisualState } from '../components/home/todayOrbitalData'
import { useOrbitalShell } from '../components/shell/OrbitalShellContext'
import { useBackendState } from '../hooks/useBackendState'
import { useCachedQuery } from '../hooks/useCachedQuery'

/** Production Today maps only DailyHome responses or previously cached DailyHome responses. */
export default function HomePage() {
  const { user } = useAuth(); const { online } = useBackendState(); const { setHeader } = useOrbitalShell(); const query = useCachedQuery(user ? `today-orbital:${user.id}` : null, getDailyHome)
  const data = useMemo(() => query.data ? toTodayOrbitalData(query.data, user, online) : null, [query.data, user, online])
  const state: TodayVisualState = !online ? 'offline-error' : !data ? 'slow-cached' : data.wordsReady === 0 && data.rememberedCards === 0 ? 'empty-new-user' : query.stale ? 'slow-cached' : 'loaded'
  useEffect(() => { setHeader(data ? { eyebrow: data.date, title: data.greeting, streak: data.streak } : { eyebrow: 'LEARNING OS', title: 'Today', streak: null }) }, [data, setHeader])
  return <TodayOrbitalCommand data={data} state={state} />
}
