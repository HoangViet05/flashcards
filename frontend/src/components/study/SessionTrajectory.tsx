type Props = { completed: number; total: number; combo: number }

const milestones = [
  ['Memory warm-up', 'Recall what is due'],
  ['Signal calibration', 'Listen and retrieve'],
  ['Meaning split', 'Connect both directions'],
  ['Session close', 'Review your result'],
]

/** A compact view of real session progress; it never invents a reward value. */
export default function SessionTrajectory({ completed, total, combo }: Props) {
  const ratio = total ? completed / total : 0
  const current = Math.min(milestones.length - 1, Math.floor(ratio * milestones.length))
  return <aside className="session-trajectory" aria-label={`${completed} of ${total} study steps complete`}><p>Session trajectory</p><ol>{milestones.map(([title, detail], index) => <li key={title} className={index < current ? 'is-complete' : index === current ? 'is-current' : ''}><span>{index < current ? '✓' : index + 1}</span><div><b>{title}</b><small>{index === current ? `${completed} of ${total} steps` : detail}</small></div></li>)}</ol>{combo > 0 && <div className="session-trajectory__combo">{combo} in flow</div>}</aside>
}
