import { useCallback, useEffect, useRef, useState } from 'react'

const PREFIX = 'swr:'
let cacheEpoch = 0

function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** Clear every SWR key and invalidate requests that started before logout. */
export function clearQueryCache() {
  cacheEpoch += 1
  if (typeof window === 'undefined') return
  const keys: string[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (key?.startsWith(PREFIX)) keys.push(key)
  }
  keys.forEach(key => window.localStorage.removeItem(key))
}

/** Return cached data immediately, then replace it with a fresh server response. */
export function useCachedQuery<T>(key: string | null, fetcher: () => Promise<T>) {
  const [state, setState] = useState<{ key: string | null; data: T | null }>(() => ({
    key,
    data: key ? readCache<T>(key) : null,
  }))
  const [loading, setLoading] = useState(key !== null && state.data === null)
  const [stale, setStale] = useState(state.data !== null)
  const fetcherRef = useRef(fetcher)
  const activeKeyRef = useRef(key)
  const requestRef = useRef(0)
  fetcherRef.current = fetcher
  activeKeyRef.current = key

  const refresh = useCallback(async () => {
    if (!key) return
    const request = ++requestRef.current
    const epoch = cacheEpoch
    setStale(true)
    try {
      const fresh = await fetcherRef.current()
      if (request !== requestRef.current || activeKeyRef.current !== key || epoch !== cacheEpoch) return
      setState({ key, data: fresh })
      setStale(false)
      try {
        window.localStorage.setItem(PREFIX + key, JSON.stringify(fresh))
      } catch {
        // Storage quota/private mode only disables persistence, not the request.
      }
    } catch (error) {
      if (request === requestRef.current && activeKeyRef.current === key) {
        console.error(`Không thể tải dữ liệu cache ${key}`, error)
      }
    } finally {
      if (request === requestRef.current && activeKeyRef.current === key) setLoading(false)
    }
  }, [key])

  useEffect(() => {
    requestRef.current += 1
    if (!key) {
      setState({ key: null, data: null })
      setLoading(false)
      setStale(false)
      return
    }

    const cached = readCache<T>(key)
    setState({ key, data: cached })
    setLoading(cached === null)
    setStale(cached !== null)
    void refresh()
  }, [key, refresh])

  const data = state.key === key ? state.data : null
  return { data, loading, stale, refresh }
}
