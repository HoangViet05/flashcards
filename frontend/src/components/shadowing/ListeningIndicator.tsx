const bars = Array.from({ length: 9 })

export default function ListeningIndicator({ transcript }: { transcript: string }) {
  return <aside className="shadowing-listening-panel" role="status" aria-label="AI đang lắng nghe">
    <div className="shadowing-listening-orb" aria-hidden="true">🎙</div>
    <div className="shadowing-waveform" aria-hidden="true">
      {bars.map((_, index) => <i key={index} />)}
    </div>
    <div className="shadowing-live-transcript" aria-live="polite">
      <span>Whisper nghe thấy</span>
      <p>{transcript || '…'}</p>
    </div>
  </aside>
}
