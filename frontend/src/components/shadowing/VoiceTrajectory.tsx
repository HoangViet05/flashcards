export default function VoiceTrajectory({ current, total }: { current: number; total: number }) {
  const allSteps = Array.from({ length: total }, (_, index) => index + 1)
  const compactSteps = total > 16
    ? Array.from(new Set([1, Math.max(2, current - 1), current, Math.min(total - 1, current + 1), total])).sort((a, b) => a - b)
    : allSteps
  const steps: Array<number | 'ellipsis'> = compactSteps.flatMap((step, index) => index && step - compactSteps[index - 1] > 1 ? ['ellipsis', step] : [step])
  return <div className="voice-trajectory-panel"><div className="voice-trajectory__summary"><span>Sentence progress</span><b>{current} / {total}</b></div><ol className="voice-trajectory" aria-label={`Sentence ${current} of ${total}`}>{steps.map((step, index) => step === 'ellipsis' ? <li className="is-ellipsis" key={`ellipsis-${index}`} aria-hidden="true">…</li> : <li key={step} className={step === current ? 'is-current' : step < current ? 'is-complete' : ''}>{step}</li>)}</ol></div>
}
