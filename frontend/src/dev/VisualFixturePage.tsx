import { useSearchParams } from 'react-router-dom'
import Icon from '../components/icons/Icon'
import { fixtureCopy, fixtureStates } from './fixtures/learningOsFixtures'
import type { FixtureState, FixtureSurface } from './fixtures/learningOsFixtures'

const validSurface = (value: string | null): FixtureSurface => value === 'study' || value === 'reader' || value === 'shadowing' ? value : 'today'

export default function VisualFixturePage() {
  const [params] = useSearchParams()
  const surface = validSurface(params.get('surface'))
  const candidate = params.get('state') as FixtureState | null
  const state = candidate && fixtureStates[surface].includes(candidate) ? candidate : fixtureStates[surface][0]
  const copy = fixtureCopy[surface][state]
  const reader = surface === 'reader'
  const voice = surface === 'shadowing'
  return <main className={`fixture-page fixture-page--${surface}`} data-testid="visual-fixture" data-surface={surface} data-state={state}>
    <div className={`fixture-grid${reader ? ' fixture-reader' : ''}`}>
      <section className={`fixture-stage glass-surface${voice ? ' fixture-voice' : ''}`}>
        <div className="fixture-copy">
          <span className="fixture-kicker">{copy.kicker}</span>
          <h2 className="fixture-title">{copy.title}</h2>
          <p>{copy.detail}</p>
          {reader ? <article className="fixture-article"><p>Teams perform better when people feel safe to ask questions, admit mistakes, and share ideas without fear. <mark>Clarify</mark> the situation before defending a decision.</p></article> : voice ? <><div className="fixture-wave" aria-label="Voice waveform">{[28, 54, 78, 42, 92, 62, 32, 72, 46].map((height, index) => <i key={index} style={{ '--wave-height': `${height}%` } as React.CSSProperties} />)}</div><button className="fixture-record" type="button" aria-label={state === 'recording' ? 'Finish recording' : 'Hold to record'}><Icon name={state === 'recording' ? 'check' : 'mic'} /></button></> : <div className="fixture-actions"><button className="fixture-action fixture-action--primary" type="button"><Icon name="play" /> Continue journey</button><button className="fixture-action" type="button"><Icon name="bolt" /> Quick study · 5 min</button></div>}
        </div>
        {!reader && !voice && <div className="fixture-orb" aria-label="Orbital companion"><div className="fixture-orb__core"><Icon name="today" /></div></div>}
      </section>
      <aside className="fixture-panel glass-surface" aria-label="Companion details">
        <span className="fixture-kicker">{reader ? 'Reading companion' : voice ? 'Calibration path' : 'System signal'}</span>
        <h2>{state === 'offline' ? 'Read-only mode' : 'Progress in view'}</h2>
        <div className="fixture-row"><span>Core energy</span><strong>72%</strong></div>
        <div className="fixture-row"><span>Weekly route</span><span className="fixture-progress" style={{ '--progress': '62%' } as React.CSSProperties}><i /></span></div>
        <div className="fixture-row"><span>{reader ? 'Saved words' : 'Active mission'}</span><strong>{reader ? '6' : '4 / 6'}</strong></div>
        <div className="fixture-row"><span>Status</span><strong>{state === 'offline' ? 'Practice ready' : 'In sync'}</strong></div>
      </aside>
    </div>
  </main>
}
