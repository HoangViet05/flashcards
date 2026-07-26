type Props = { completed: number; total: number; combo: number }

export default function SessionTrajectory({ completed, total, combo }: Props) {
  const checkpoints = Math.max(1, Math.min(7, total || 1))
  return <ol className="session-trajectory" aria-label={`${completed} of ${total} study steps complete`}>{Array.from({ length: checkpoints }, (_, index) => <li key={index} className={index < Math.round(completed * checkpoints / Math.max(total, 1)) ? 'is-complete' : ''}><span>{index + 1}</span></li>)}{combo >= 3 && <li className="session-trajectory__combo">{combo}x flow</li>}</ol>
}
