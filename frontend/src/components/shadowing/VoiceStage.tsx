import type { ReactNode } from 'react'
import AiOrb, { type OrbState } from '../orb/AiOrb'

type VoiceState = 'ready' | 'recording' | 'processing' | 'score' | 'offline'
const orbState: Record<VoiceState, OrbState> = { ready: 'listening', recording: 'recording', processing: 'processing', score: 'success', offline: 'offline' }

export default function VoiceStage({ state, source, target, children }: { state: VoiceState; source: string; target: string; children: ReactNode }) {
  const status = { ready: 'Listen, then record your response.', recording: 'Recording your voice…', processing: 'Scoring your signal…', score: 'Signal scored. Choose the next move.', offline: 'Offline practice keeps your recording private.' }[state]
  return <section className={`voice-stage voice-stage--${state}`}><header><div><p>Voice calibration · {source}</p><h2>{status}</h2></div><AiOrb state={orbState[state]} compact /></header><p className="voice-stage__target">{target}</p><div className="voice-stage__wave" aria-hidden="true">{[35, 70, 100, 58, 83, 46, 92, 62, 38].map((height, index) => <i key={index} style={{ '--height': `${height}%`, '--delay': `${index * 55}ms` } as React.CSSProperties} />)}</div><div className="voice-stage__controls">{children}</div></section>
}
