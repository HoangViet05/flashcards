import { createElement, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import ListeningIndicator from './ListeningIndicator'
export function useRecorder(maxSeconds = 20) {
  const [recording, setRecording] = useState(false), [blob, setBlob] = useState<Blob | null>(null), [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null), timerRef = useRef<number | null>(null)
  const clearTimer = () => { if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null } }
  const stop = useCallback(() => { clearTimer(); const recorder = recorderRef.current; if (recorder && recorder.state !== 'inactive') recorder.stop() }, [])
  const start = useCallback(async () => { setError(null); setBlob(null); try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }), type = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined, recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined), chunks: BlobPart[] = []; recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }; recorder.onstop = () => { stream.getTracks().forEach(track => track.stop()); setRecording(false); setBlob(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })) }; recorderRef.current = recorder; recorder.start(); setRecording(true); timerRef.current = window.setTimeout(stop, maxSeconds * 1000) } catch { setError('Không truy cập được micro. Hãy cho phép quyền micro trong trình duyệt rồi thử lại.') } }, [maxSeconds, stop])
  const reset = useCallback(() => { clearTimer(); const recorder = recorderRef.current; if (recorder && recorder.state !== 'inactive') { recorder.onstop = () => recorder.stream.getTracks().forEach(track => track.stop()); recorder.stop(); setRecording(false) }; setBlob(null); setError(null) }, [])
  useEffect(() => {
    if (!recording) return
    const host = document.createElement('div'), root = createRoot(host)
    document.body.appendChild(host)
    root.render(createElement(ListeningIndicator))
    return () => { root.unmount(); host.remove() }
  }, [recording])
  useEffect(() => () => reset(), [reset]); return { recording, blob, error, start, stop, reset }
}
