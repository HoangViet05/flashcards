export default function VoiceTrajectory({ current, total }: { current: number; total: number }) {
  return <ol className="voice-trajectory" aria-label={`Sentence ${current} of ${total}`}>{Array.from({ length: total }, (_, index) => <li key={index} className={index + 1 === current ? 'is-current' : index + 1 < current ? 'is-complete' : ''}>{index + 1}</li>)}</ol>
}
