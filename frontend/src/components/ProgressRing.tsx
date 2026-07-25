interface Props { percent: number; label: string; sub?: string }

export default function ProgressRing({ percent, label, sub }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const radius = 34
  const circumference = 2 * Math.PI * radius
  return <div className="relative h-24 w-24 shrink-0" role="img" aria-label={`Tiến độ ${clamped}%`}>
    <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
      <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
      <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--color-accent-2)" strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - clamped / 100)} style={{ transition: 'stroke-dashoffset var(--dur-slow) ease' }} />
    </svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-lg font-black text-strong-text">{label}</span>{sub && <span className="text-[10px] font-semibold text-muted">{sub}</span>}</div>
  </div>
}
