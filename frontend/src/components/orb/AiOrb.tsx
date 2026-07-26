import { useEffect, useState } from 'react'
import { orbMessage } from './orbMessages'
import './AiOrb.css'
export type OrbState = 'idle' | 'thinking' | 'loading' | 'correct' | 'wrong' | 'combo' | 'listening' | 'recording' | 'processing' | 'success' | 'offline'
export function AiOrb({ state = 'idle', compact = false, label }: { state?: OrbState; compact?: boolean; label?: string }) {
  const [message, setMessage] = useState(() => orbMessage(state))
  useEffect(() => setMessage(label ?? orbMessage(state)), [state, label])
  return <div className={`ai-orb ai-orb--${state} ${compact ? 'ai-orb--compact' : ''}`} aria-live={['loading', 'offline', 'processing'].includes(state) ? 'polite' : undefined}>
    <span className="ai-orb__orbit" aria-hidden="true" /><span className="ai-orb__orbit ai-orb__orbit--outer" aria-hidden="true" />
    <span className="ai-orb__core" aria-hidden="true" />
    {['listening', 'recording', 'processing'].includes(state) && <span className="ai-orb__signal" aria-hidden="true">{[32, 72, 100, 56, 84].map((height, index) => <i key={index} style={{ '--h': `${height}%` } as React.CSSProperties} />)}</span>}
    {!compact && <p>{message}</p>}
  </div>
}
export default AiOrb
