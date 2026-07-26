import { useState } from 'react'
import { Link } from 'react-router-dom'
import AiOrb, { type OrbState } from '../orb/AiOrb'
import Icon from '../icons/Icon'
import type { JourneyPoint, TodayOrbitalData, TodayVisualState } from './todayOrbitalData'

const mark = (name: 'today' | 'read' | 'sound' | 'check' | 'mic' | 'play' | 'bolt' | 'settings') => <Icon name={name} />
const journeyDetail = (point: JourneyPoint) => `${point.label}: ${point.complete ? 'completed' : point.active ? 'active' : 'not active'} in your current journey.`

/** Route content only. AppShell owns the single Orbital navigation shell. */
export default function TodayOrbitalCommand({ data, state, onRetry }: { data: TodayOrbitalData | null; state: TodayVisualState; onRetry: () => void }) {
  const [orbDetail, setOrbDetail] = useState<string | null>(null)
  const [selectedJourney, setSelectedJourney] = useState<JourneyPoint | null>(null)
  const unavailable = state === 'offline-error'

  if (!data) {
    const orbState: OrbState = unavailable ? 'offline' : 'loading'
    const status = unavailable ? 'Learning service is temporarily unavailable.' : 'Starting your learning space…'
    return <section className="ftd-concept ftd-orbital" data-testid="today-orbital-command" data-state={state} aria-busy={!unavailable}>
      <section className="card ftd-core-hero">
        <div className="ftd-core-copy"><span className="ftd-overline">DAILY CORE</span><h3>{status}</h3><p>{unavailable ? 'Please try again in a moment.' : 'Connecting to your saved learning plan.'}</p>{unavailable && <div className="viz-row"><button className="btn btn-primary" type="button" onClick={onRetry}>Retry</button></div>}</div>
        <div className="ftd-orb-zone"><AiOrb state={orbState} label={status} showMessage={false} onActivate={() => setOrbDetail(status)} activationLabel="Show learning service status" /><span className="ftd-orb-caption">Core energy</span>{orbDetail && <span className="ftd-orb-message" role="status">{orbDetail}</span>}</div>
        <div className="ftd-core-stats" aria-label="Learning metrics unavailable"><div><span>WORDS READY</span><b>—</b><small>—</small></div><div><span>REMEMBERED</span><b>—</b><small>—</small></div><div><span>FOCUS TODAY</span><b>—</b><small>—</small></div></div>
      </section>
      <div className="ftd-lower-grid ftd-skeleton-grid" aria-label={unavailable ? 'Unavailable learning details' : 'Loading learning details'}><section className="card ftd-missions ftd-skeleton-card"><div className="ftd-section-title"><div><span className="ftd-overline">ACTIVE QUESTS</span><h3>{unavailable ? 'Missions unavailable' : 'Loading missions'}</h3></div></div><i /><i /><i /></section><section className="card ftd-week ftd-skeleton-card"><div className="ftd-section-title"><div><span className="ftd-overline">WEEKLY JOURNEY</span><h3>{unavailable ? 'Journey unavailable' : 'Loading journey'}</h3></div></div><i /><i /><i /></section></div>
    </section>
  }

  const disabled = !data.mutationsAvailable
  return <section className="ftd-concept ftd-orbital" data-testid="today-orbital-command" data-state={state} data-concept-panel="orbital">
    <section className="card ftd-core-hero">
      <div className="ftd-core-copy"><span className="ftd-overline">DAILY CORE · {data.energy}% COMPLETE</span><h3>{data.headline}</h3><p>{data.summary}</p><div className="viz-row"><Link className="btn btn-primary" to={data.primaryTo} aria-disabled={disabled} onClick={disabled ? event => event.preventDefault() : undefined}>{mark('play')} {data.primaryLabel}</Link><Link className="btn" to={data.quickTo} aria-disabled={disabled} onClick={disabled ? event => event.preventDefault() : undefined}>{mark('bolt')} Quick study</Link></div><span className="ftd-reward">{mark('today')}{data.statusNote}</span></div>
      <div className="ftd-orb-zone"><AiOrb state={data.orbState} label={data.orbMessage} showMessage={false} onActivate={() => setOrbDetail(data.orbMessage)} activationLabel="Show today’s learning status" /><b>{data.energy}%</b><span className="ftd-orb-caption">Core completion</span>{orbDetail && <span className="ftd-orb-message" role="status">{orbDetail}</span>}</div>
      <div className="ftd-core-stats"><Link to="/daily" className="ftd-metric-link"><span>WORDS READY</span><b>{data.wordsReady}</b><small>{`${data.dueCount} review · ${data.newCount} new`}</small></Link><Link to="/stats" className="ftd-metric-link"><span>REMEMBERED</span><b>{data.rememberedCards}</b><small>{data.studyMinutesWeek}m this week</small></Link><Link to="/stats" className="ftd-metric-link"><span>FOCUS TODAY</span><b>{data.studyMinutesToday}m</b><small>Real study time</small></Link></div>
    </section>
    <div className="ftd-lower-grid">
      <section className="card ftd-missions"><div className="ftd-section-title"><div><span className="ftd-overline">ACTIVE QUESTS</span><h3>Today’s missions</h3></div><b>{data.completedMissions}/{data.missions.length}</b></div>{data.missions.length ? data.missions.map(mission => <Link className={`ftd-mission${mission.done ? ' is-done' : ''}`} key={mission.id} to={mission.to} aria-label={`${mission.title}, ${mission.progress}`}><span>{mark(mission.icon)}</span><div><b>{mission.title}</b><small>{mission.detail}</small>{mission.percent && <i><em style={{ '--p': mission.percent } as React.CSSProperties} /></i>}</div><strong>{mission.progress}</strong></Link>) : <div className="ftd-mission"><span>{mark('today')}</span><div><b>No missions assigned</b><small>Complete onboarding to receive a daily plan.</small></div><strong>—</strong></div>}</section>
      <section className="card ftd-week"><div className="ftd-section-title"><div><span className="ftd-overline">WEEKLY JOURNEY</span><h3>System synchronization</h3></div></div>{data.journey.length ? <><div className="ftd-week-path" aria-label="Weekly journey">{data.journey.map(point => <button className={point.complete ? 'is-complete' : point.active ? 'is-current' : ''} type="button" key={point.label} onClick={() => setSelectedJourney(point)} aria-label={journeyDetail(point)} aria-pressed={selectedJourney?.label === point.label}><span>{point.label}</span>{point.complete ? mark('check') : mark(point.active ? 'today' : 'settings')}</button>)}</div><p className="ftd-journey-detail" role="status">{selectedJourney ? journeyDetail(selectedJourney) : 'Select a journey checkpoint for its current status.'}</p></> : <p className="ftd-reward">Journey data is unavailable.</p>}<div className="ftd-skill-strips">{data.skills.length ? data.skills.map(skill => <Link to="/stats" key={skill.label} aria-label={`${skill.label}, level ${skill.level}, ${skill.percent}% mastery`}><span>{mark(skill.icon)} {skill.label} · Lv. {skill.level}</span><b><i style={{ '--p': `${skill.percent}%` } as React.CSSProperties} /></b><strong>{skill.percent}%</strong></Link>) : <div><span>Skills unavailable</span><b><i style={{ '--p': '0%' } as React.CSSProperties} /></b><strong>0%</strong></div>}</div></section>
    </div>
  </section>
}
