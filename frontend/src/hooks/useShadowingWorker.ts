import { useCallback, useEffect, useState } from 'react'
import { getWorkerHealth, type WorkerHealth } from '../api/shadowingWorker'
export type WorkerStatus = 'checking' | 'online' | 'offline'
export function useShadowingWorker(pollMs = 15000) {
  const [status, setStatus] = useState<WorkerStatus>('checking'); const [health, setHealth] = useState<WorkerHealth | null>(null)
  const refresh = useCallback(async () => { try { const value = await getWorkerHealth(); setHealth(value); setStatus('online') } catch { setHealth(null); setStatus('offline') } }, [])
  useEffect(() => { void refresh(); const id = window.setInterval(() => void refresh(), pollMs); return () => window.clearInterval(id) }, [refresh, pollMs])
  return { status, health, refresh }
}
