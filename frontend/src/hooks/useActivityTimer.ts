import { useEffect, useRef } from 'react'
import { sendEvents, type EventInput } from '../api/events'

/** Records coarse, visible focused time. It deliberately never sends a heartbeat. */
export function useActivityTimer(input: Omit<EventInput, 'duration_seconds' | 'idempotency_key'>, enabled = true) {
  const started = useRef(Date.now()); const active = useRef(Date.now())
  useEffect(() => {
    const touch = () => { active.current = Date.now() }; const visibility = () => { if (!document.hidden) touch() }
    window.addEventListener('pointerdown', touch); window.addEventListener('keydown', touch); document.addEventListener('visibilitychange', visibility)
    return () => { window.removeEventListener('pointerdown', touch); window.removeEventListener('keydown', touch); document.removeEventListener('visibilitychange', visibility); const duration = Math.min(300, Math.max(0, Math.round((Math.min(Date.now(), active.current + 60_000) - started.current) / 1000))); if (enabled && duration >= 15 && navigator.onLine) void sendEvents([{ ...input, duration_seconds: duration, idempotency_key: `${input.skill}-${input.source_id ?? 'screen'}-${started.current}` }]).catch(() => undefined) }
  }, [enabled, input.event_type, input.skill, input.source_id, input.source_type])
}
