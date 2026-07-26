import { useMemo } from 'react'
import { getProgressOverview } from '../api/progress'
import { useAuth } from '../auth/AuthContext'
import AiOrb from '../components/orb/AiOrb'
import { useCachedQuery } from '../hooks/useCachedQuery'

function ProgressContent() {
  const { user } = useAuth(); const query = useCachedQuery(user ? `progress:${user.id}` : null, getProgressOverview); const progress = query.data
  if (!progress) return <div className="page-center"><AiOrb state="loading" /></div>
  const days = useMemo(() => Object.entries(progress.heatmap).slice(-28), [progress.heatmap])
  return <main className="progress-page"><header><p className="eyebrow">Progress</p><h1>Learning, made visible.</h1><p>Your return rhythm, time invested, and durable recall.</p></header><section className="kpi-grid">{[{ label: 'Current streak', value: `${progress.streak} days` }, { label: 'This week', value: `${progress.study_minutes_week} min` }, { label: 'Remembered', value: String(progress.remembered_cards) }, { label: 'Retention', value: progress.retention === null ? 'Building signal' : `${progress.retention}%` }].map(item => <article className="glass-panel" key={item.label}><span>{item.label}</span><strong>{item.value}</strong></article>)}</section><section className="glass-panel"><div className="section-heading"><h2>Skill paths</h2><span>Level only moves forward</span></div><div className="skill-grid">{progress.skills.map(skill => <article className="skill-card" key={skill.skill}><p>{skill.skill}</p><strong>Level {skill.level}</strong><span>{skill.mastery === null ? 'Building signal' : `${skill.mastery}% mastery`}</span><div className="skill-meter"><i style={{ width: `${skill.mastery ?? Math.min(90, skill.xp % 100)}%` }} /></div></article>)}</div></section><section className="glass-panel heatmap-panel"><div className="section-heading"><h2>Last 28 days</h2><span>{days.length} active days</span></div><div className="progress-heatmap" role="img" aria-label="Study time during the last 28 days">{days.map(([day, seconds]) => <i key={day} title={`${day}: ${Math.round(seconds / 60)} minutes`} style={{ opacity: Math.max(.15, Math.min(1, seconds / 900)) }} />)}</div><p>Cells show focused study time. Missing data is never treated as a score of zero.</p></section></main>
}

export function LearningStats() { return <ProgressContent /> }
export default function StatsPage() { return <ProgressContent /> }
