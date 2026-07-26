import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getDailyHome } from '../api/daily'
import { rerollMission } from '../api/missions'
import { useAuth } from '../auth/AuthContext'
import AiOrb from '../components/orb/AiOrb'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { useBackendState } from '../hooks/useBackendState'
import type { DailyHome, Mission } from '../types'
import { features } from '../config/features'
import TodayOrbitalCommand from '../components/home/TodayOrbitalCommand'

const labels: Record<string, string> = { study_answers: 'Recall words', study_session: 'Start a study session', reading_minutes: 'Read with focus', read_complete: 'Complete a reading', listen_answers: 'Practice listening', shadowing: 'Practice speaking' }

function Missions({ items, refresh }: { items: Mission[]; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null)
  const reroll = async (mission: Mission) => { setBusy(mission.id); try { await rerollMission(mission.id); await refresh() } finally { setBusy(null) } }
  return <section className="command-card command-missions"><header className="command-title"><div><span>Active quests</span><h2>Today’s missions</h2></div><b>{items.filter(item => item.completed_at).length}/{items.length}</b></header>{items.map(mission => <article className="command-mission" key={mission.id}><span>{mission.completed_at ? '✓' : mission.skill[0].toUpperCase()}</span><div><strong>{labels[mission.mission_key] ?? mission.mission_key}</strong><small>{mission.progress}/{mission.target} · {mission.skill}</small><i><em style={{ width: `${Math.min(100, mission.progress / mission.target * 100)}%` }} /></i></div><b>{mission.completed_at ? '+20 XP' : `${Math.round(100 * mission.progress / mission.target)}%`}</b>{!mission.completed_at && !mission.rerolled && <button disabled={busy === mission.id} onClick={() => void reroll(mission)} aria-label={`Reroll ${labels[mission.mission_key] ?? mission.mission_key}`}>↻</button>}</article>)}</section>
}

function Trajectory({ home }: { home: DailyHome }) {
  const journey = home.journey
  return <section className="command-card command-journey"><header className="command-title"><div><span>Week in motion</span><h2>System synchronization</h2></div><Link to="/boss">{journey?.boss_available ? 'Boss is open' : 'Boss opens Friday'}</Link></header>{journey?.lanes.map(lane => <div className="command-lane" key={lane.skill}><span>{lane.skill}</span><div>{lane.checkpoints.map(checkpoint => <i className={checkpoint.active ? 'active' : ''} key={checkpoint.date} />)}</div></div>)}</section>
}

export default function HomePage() {
  if (features.visualTodayProof) return <TodayOrbitalCommand />
  const { user } = useAuth(); const { online } = useBackendState(); const query = useCachedQuery(user ? `command-center:${user.id}` : null, getDailyHome); const [slow, setSlow] = useState(false)
  useEffect(() => { const id = window.setTimeout(() => setSlow(true), 1200); return () => window.clearTimeout(id) }, [])
  const home = query.data
  if (!home) return <main className="command-center"><section className="command-hero command-loading"><div><span className="command-eyebrow">Daily core</span><h1>{slow ? 'Starting your learning space…' : 'Preparing your route.'}</h1><p>Your learning world remains in place while we reconnect.</p></div><AiOrb state={slow ? 'loading' : 'thinking'} /><div className="command-loading-bars"><i /><i /><i /></div></section><div className="command-lower"><section className="command-card command-placeholder" /><section className="command-card command-placeholder" /></div></main>
  const empty = home.total_cards === 0
  const skills = home.progression?.skills ?? []
  return <main className="command-center"><section className="command-hero"><div className="command-copy"><span className="command-eyebrow">Daily core · {empty ? 'ready for activation' : '72% charged'}</span><h1>{empty ? 'Build your first learning path.' : 'Keep your momentum alive.'}</h1><p>{online ? `A ${home.new_count + home.due_count}-word focus is ready for your next session.` : 'You are offline. Cached progress and read-only navigation remain available.'}</p><div className="command-actions">{empty ? <Link className="command-primary" to="/reader">Choose your first reading</Link> : <Link className="command-primary" to="/daily">Continue journey · 24 min</Link>}<Link className="command-secondary" to="/daily/quick">Quick study · 5 min</Link></div><small>Complete a session to earn XP and power today’s node.</small></div><AiOrb state={online ? 'idle' : 'offline'} /><div className="command-metrics"><span><b>{home.new_count + home.due_count}</b>words ready</span><span><b>{home.progression?.streak ?? home.streak}</b>day streak</span><span><b>{home.progression?.study_minutes_today ?? 0}m</b>focus today</span></div></section>{!online && <p className="command-offline">Offline: study mutations wait for reconnection.</p>}{empty ? <section className="command-card command-empty"><span className="command-eyebrow">First signal</span><h2>Start with something useful.</h2><p>Read a work-focused article or bring in the vocabulary you actually need.</p><Link className="command-secondary" to="/library">Import a deck</Link></section> : <><div className="command-lower"><Missions items={home.missions?.daily ?? []} refresh={query.refresh} /><Trajectory home={home} /></div><section className="command-skills">{skills.map(skill => <div key={skill.skill}><span>{skill.skill} · Lv. {skill.level}</span><b><i style={{ width: `${skill.mastery ?? Math.min(90, skill.xp % 100)}%` }} /></b><strong>{skill.building_signal ? 'Building signal' : `${skill.mastery}%`}</strong></div>)}</section></>}</main>
}
