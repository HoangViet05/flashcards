const bars = Array.from({ length: 9 })

export default function ListeningIndicator() {
  return <aside className="shadowing-listening-panel" role="status" aria-live="polite">
    <div className="shadowing-listening-orb" aria-hidden="true">🎙</div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-black tracking-wide text-white">AI đang lắng nghe</span>
        <span className="shadowing-live-dot">LIVE</span>
      </div>
      <div className="shadowing-waveform" aria-hidden="true">
        {bars.map((_, index) => <i key={index} />)}
      </div>
      <p className="mt-1 text-xs text-emerald-50/75">Nói tự nhiên, mình đang bắt nhịp</p>
    </div>
  </aside>
}
