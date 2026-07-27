import { useEffect, useState } from 'react'
import { orbMessage } from './orbMessages'
import './AiOrb.css'

export type OrbState = 'idle' | 'thinking' | 'loading' | 'correct' | 'wrong' | 'combo' | 'listening' | 'recording' | 'processing' | 'success' | 'offline'

type AiOrbProps = {
  state?: OrbState
  compact?: boolean
  label?: string
  showMessage?: boolean
  onActivate?: () => void
  activationLabel?: string
}

/** Shared visual orb. Consumers may supply a local, data-backed activation action. */
export function AiOrb({ state = 'idle', compact = false, label, showMessage = true, onActivate, activationLabel = 'Show learning status' }: AiOrbProps) {
  const [message, setMessage] = useState(() => label ?? orbMessage(state))
  useEffect(() => setMessage(label ?? orbMessage(state)), [state, label])
  const visual = <><span className="ai-orb__orbit" aria-hidden="true"><i className="ai-orb__satellite ai-orb__satellite--amber" /><i className="ai-orb__satellite ai-orb__satellite--blue" /></span><span className="ai-orb__orbit ai-orb__orbit--outer" aria-hidden="true"><i className="ai-orb__satellite ai-orb__satellite--mint" /></span><span className="ai-orb__core" aria-hidden="true" />{['listening', 'recording', 'processing'].includes(state) && <span className="ai-orb__signal" aria-hidden="true">{[32, 72, 100, 56, 84].map((height, index) => <i key={index} style={{ '--h': `${height}%` } as React.CSSProperties} />)}</span>}</>
  return <div className={`ai-orb ai-orb--${state} ${compact ? 'ai-orb--compact' : ''} ${onActivate ? 'ai-orb--interactive' : ''}`} aria-live={['loading', 'offline', 'processing'].includes(state) ? 'polite' : undefined}>
    {onActivate ? <button className="ai-orb__button" type="button" onClick={onActivate} aria-label={activationLabel}>{visual}</button> : visual}
    {!compact && showMessage && <p>{message}</p>}
  </div>
}

export default AiOrb
