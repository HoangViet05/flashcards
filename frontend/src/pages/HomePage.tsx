import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getDailyHome } from '../api/daily'
import { rerollMission } from '../api/missions'
import { useAuth } from '../auth/AuthContext'
import AiOrb from '../components/orb/AiOrb'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { useBackendState } from '../hooks/useBackendState'
import type { DailyHome, Mission } from '../types'

const labels: Record<string, string> = { study_answers: 'Recall words', study_session: 'Start a study session', reading_minutes: 'Read with focus', read_complete: 'Complete a reading', listen_answers: 'Practice listening', shadowing: 'Practice speaking' }

function SkillOverview({ home }: { home: DailyHome }) {
  return <section className="command-section"><div className="section-heading"><h2>Your skills</h2><span>Four paths, one journey</span></div><div className="skill-grid">{home.progression?.skills.map(skill => <article key={skill.skill} className="glass-panel skill-card"><p>{skill.skill}</p><strong>Level {skill.level}</strong><span>{skill.building_signal ? 'Building signal' : `${skill.mastery}% mastery`}</span><div className="skill-meter"><i style={{ width: `${skill.mastery ?? Math.min(90, skill.xp % 100)}%` }} /></div></article>)}</div></section>
}

function MissionList({ items, refresh }: { items: Mission[]; refresh: () => Promise<void> }) {
  const [rerolling, setRerolling] = useState<string | null>(null)
  const reroll = async (mission: Mission) => { setRerolling(mission.id); try { await rerollMission(mission.id); await refresh() } finally { setRerolling(null) } }
  return <section className="command-section"><div className="section-heading"><h2>Today’s missions</h2><span>Auto-rewarded</span></div><div className="mission-list">{items.map(mission => <article className="mission-card" key={mission.id}><div><strong>{labels[mission.mission_key] ?? mission.mission_key}</strong><span>{mission.progress}/{mission.target} · {mission.skill}</span></div><div className="mission-actions"><b>{mission.completed_at ? 'Complete' : `${Math.round(100 * mission.progress / mission.target)}%`}</b>{!mission.completed_at && !mission.rerolled && <button disabled={rerolling === mission.id} onClick={() => void reroll(mission)}>Reroll</button>}</div></article>)}</div></section>
}

function JourneyMap({ home }: { home: DailyHome }) {
  const journey = home.journey
  if (!journey) return null
  return <section className="command-section journey"><div className="section-heading"><h2>This week</h2><Link to="/boss">{journey.boss_available ? 'Boss is open' : 'Boss opens Friday'}</Link></div>{journey.lanes.map(lane => <div className="journey-lane" key={lane.skill}><span>{lane.skill}</span><div>{lane.checkpoints.map(checkpoint => <i className={checkpoint.active ? 'active' : ''} key={checkpoint.date} title={checkpoint.date} />)}</div></div>)}</section>
}

export default function HomePage() {
  const { user } = useAuth(); const { online } = useBackendState(); const query = useCachedQuery(user ? `command-center:${user.id}` : null, getDailyHome); const [slow, setSlow] = useState(false)
  useEffect(() => { const timer = window.setTimeout(() => setSlow(true), 1200); return () => window.clearTimeout(timer) }, [])
  const home = query.data
  if (!home) return <div className="command-center page-center"><AiOrb state={slow ? 'loading' : 'thinking'} /></div>
  const isEmpty = home.total_cards === 0
  return <main className="command-center"><section className="command-hero glass-panel"><AiOrb compact state={online ? 'idle' : 'offline'} /><div><p className="eyebrow">Today</p><h1>{isEmpty ? 'Build your first learning path.' : 'Continue your journey.'}</h1><p>{online ? `A ${home.new_count + home.due_count}-word focus is ready.` : 'You are offline. Your last synced plan is still here.'}</p><div className="hero-actions">{isEmpty ? <Link className="button-primary" to="/reader">Choose your first reading</Link> : <Link className="button-primary" to="/daily">Continue journey</Link>}<Link className="button-secondary" to="/daily/quick">Quick study · 5 min</Link></div></div><div className="hero-kpis"><span><b>{home.progression?.streak ?? home.streak}</b> day streak</span><span><b>{home.progression?.study_minutes_today ?? 0}</b> minutes today</span><span><b>{home.progression?.remembered_cards ?? home.mastered_cards}</b> remembered</span></div></section>{!online && <p className="offline-note">Offline: study mutations stay disabled until you reconnect.</p>}{!isEmpty && <><SkillOverview home={home} /><MissionList items={home.missions?.daily ?? []} refresh={query.refresh} /><JourneyMap home={home} /></>} {isEmpty && <section className="empty-actions glass-panel"><h2>Start with something useful</h2><p>Read a work-focused article or bring in the vocabulary you already need.</p><Link to="/library" className="button-secondary">Import a deck</Link></section>}</main>
}
