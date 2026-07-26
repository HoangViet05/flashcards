import { useMemo } from 'react'
import { getDailyHome } from '../api/daily'
import { useAuth } from '../auth/AuthContext'
import TodayOrbitalCommand from '../components/home/TodayOrbitalCommand'
import { fixtureForState, toTodayOrbitalData } from '../components/home/todayOrbitalData'
import type { TodayOrbitalData, TodayVisualState } from '../components/home/todayOrbitalData'
import { features } from '../config/features'
import { useBackendState } from '../hooks/useBackendState'
import { useCachedQuery } from '../hooks/useCachedQuery'

const visualStates: TodayVisualState[] = ['loaded', 'slow-cached', 'empty-new-user', 'offline-error']

function requestedVisualState(): TodayVisualState {
  const state = new URLSearchParams(window.location.search).get('today-state')
  return visualStates.includes(state as TodayVisualState) ? state as TodayVisualState : 'loaded'
}

function requestedDelay(): number {
  const value = Number(new URLSearchParams(window.location.search).get('today-delay') ?? '0')
  return value === 1200 || value === 8000 ? value : 0
}

/** Data is always adapted here; visual QA only substitutes deterministic input for the same production surface. */
export default function HomePage() {
  const { user } = useAuth()
  const { online } = useBackendState()
  const fixtureMode = features.visualTodayProof
  const visualState = requestedVisualState()
  const delay = requestedDelay()
  const fixture = useMemo(() => fixtureForState(visualState), [visualState])
  const query = useCachedQuery<TodayOrbitalData>(
    fixtureMode ? `today-orbital-visual:${visualState}:${delay}` : user ? `today-orbital:${user.id}` : null,
    fixtureMode ? () => new Promise(resolve => window.setTimeout(() => resolve(fixture), delay)) : async () => toTodayOrbitalData(await getDailyHome(), online),
  )

  const data = fixtureMode ? fixture : query.data ?? fixtureForState(!online ? 'offline-error' : 'slow-cached')
  const state: TodayVisualState = fixtureMode
    ? visualState
    : !online ? 'offline-error'
      : data.wordsReady === 0 && data.streak === 0 ? 'empty-new-user'
        : query.loading || query.stale ? 'slow-cached'
          : 'loaded'

  return <TodayOrbitalCommand data={data} state={state} />
}
