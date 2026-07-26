import { useEffect, useState } from 'react'
import { orbMessage } from './orbMessages'
export type OrbState = 'idle' | 'thinking' | 'loading' | 'correct' | 'wrong' | 'combo' | 'listening' | 'recording' | 'processing' | 'success' | 'offline'
export function AiOrb({ state = 'idle', compact = false, label }: { state?: OrbState; compact?: boolean; label?: string }) { const [message, setMessage] = useState(() => orbMessage(state)); useEffect(() => setMessage(label ?? orbMessage(state)), [state, label]); return <div className={`ai-orb ai-orb--${state} ${compact ? 'ai-orb--compact' : ''}`} aria-live={['loading', 'offline', 'processing'].includes(state) ? 'polite' : undefined}><span className="ai-orb__core" aria-hidden="true" /><span className="ai-orb__halo" aria-hidden="true" />{!compact && <p>{message}</p>}</div> }
export default AiOrb
