import { useCallback, useEffect, useRef, useState } from 'react'

const PREFIX = 'swr:'
const RETRY_DELAYS_MS = [0, 500, 1500] as const
let cacheEpoch = 0

function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) as T : null
  } catch {
    return null
  }
}

export function clearQueryCache() {
  cacheEpoch += 1
  if (typeof window === 'undefined') return
  const keys: string[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key?.startsWith(PREFIX)) keys.push(key)
  }
  keys.forEach(key => window.localStorage.removeItem(key))
}

/**
 * Shows a previous successful response while retrying. A failed request is
 * observable by consumers after a short, bounded backoff rather than being
 * silently converted into an indefinitely-loading screen.
 */
export function useCachedQuery<T>(key: string | null, fetcher: () => Promise<T>) {
  const [state, setState] = useState<{ key: string | null; data: T | null }>(() => ({ key, data: key ? readCache<T>(key) : null }))
  const [loading, setLoading] = useState(key !== null && state.data === null)
  const [stale, setStale] = useState(state.data !== null)
  const [error, setError] = useState<unknown>(null)
  const fetcherRef = useRef(fetcher)
  const activeKeyRef = useRef(key)
  const requestRef = useRef(0)
  const dataRef = useRef(state.data)

  fetcherRef.current = fetcher
  activeKeyRef.current = key
  dataRef.current = state.data

  const refresh = useCallback(async () => {
    if (!key) return

    const request = ++requestRef.current
    const epoch = cacheEpoch
    setLoading(dataRef.current === null)
    setStale(true)
    setError(null)
    let failure: unknown = null

    for (const delay of RETRY_DELAYS_MS) {
      if (delay) await new Promise(resolve => window.setTimeout(resolve, delay))
      try {
        const fresh = await fetcherRef.current()
        if (request !== requestRef.current || activeKeyRef.current !== key || epoch !== cacheEpoch) return
        setState({ key, data: fresh })
        setLoading(false)
        setStale(false)
        setError(null)
        try {
          window.localStorage.setItem(PREFIX + key, JSON.stringify(fresh))
        } catch {
          // Persistence is optional; the in-memory response remains valid.
        }
        return
      } catch (caught) {
        failure = caught
      }
    }

    if (request === requestRef.current && activeKeyRef.current === key) {
      setError(failure)
      setLoading(false)
      setStale(dataRef.current !== null)
    }
  }, [key])

  useEffect(() => {
    requestRef.current += 1
    if (!key) {
      setState({ key: null, data: null })
      setLoading(false)
      setStale(false)
      setError(null)
      return
    }

    const cached = readCache<T>(key)
    setState({ key, data: cached })
    setLoading(cached === null)
    setStale(cached !== null)
    setError(null)
    void refresh()
  }, [key, refresh])

  const data = state.key === key ? state.data : null
  return { data, loading, stale, error, refresh }
}
