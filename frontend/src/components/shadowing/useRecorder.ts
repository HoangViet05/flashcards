import { createElement, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { transcribeRecording } from '../../api/shadowingWorker'
import ListeningIndicator from './ListeningIndicator'

const PARTIAL_TRANSCRIPT_INTERVAL_MS = 3000

export function useRecorder(maxSeconds = 20) {
  const [recording, setRecording] = useState(false), [blob, setBlob] = useState<Blob | null>(null), [error, setError] = useState<string | null>(null), [liveTranscript, setLiveTranscript] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null), timerRef = useRef<number | null>(null), chunksRef = useRef<BlobPart[]>([]), partialBusyRef = useRef(false), partialLastAtRef = useRef(0), partialVersionRef = useRef(0), indicatorRootRef = useRef<Root | null>(null)
  const clearTimer = () => { if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null } }
  const requestPartialTranscript = useCallback((mimeType: string) => {
    if (partialBusyRef.current || !chunksRef.current.length) return
    partialBusyRef.current = true
    const version = ++partialVersionRef.current, partial = new Blob([...chunksRef.current], { type: mimeType || 'audio/webm' })
    void transcribeRecording(partial).then(({ transcript }) => { if (version === partialVersionRef.current) setLiveTranscript(transcript) }).catch(() => {}).finally(() => { partialBusyRef.current = false })
  }, [])
  const stop = useCallback(() => { clearTimer(); const recorder = recorderRef.current; if (recorder && recorder.state !== 'inactive') recorder.stop() }, [])
  const start = useCallback(async () => {
    setError(null); setBlob(null); setLiveTranscript(''); partialBusyRef.current = false; partialLastAtRef.current = 0; partialVersionRef.current = 0; chunksRef.current = []
    try {
      const testApi = window as typeof window & { __flashieRecorderApi?: { getUserMedia: () => Promise<MediaStream>; MediaRecorder: typeof MediaRecorder } }
      const media = testApi.__flashieRecorderApi ?? { getUserMedia: () => navigator.mediaDevices.getUserMedia({ audio: true }), MediaRecorder }
      const stream = await media.getUserMedia(), type = media.MediaRecorder.isTypeSupported?.('audio/webm') ? 'audio/webm' : undefined, recorder = new media.MediaRecorder(stream, type ? { mimeType: type } : undefined)
      recorder.ondataavailable = event => {
        if (!event.data.size) return
        chunksRef.current.push(event.data)
        const now = Date.now()
        if (now - partialLastAtRef.current >= PARTIAL_TRANSCRIPT_INTERVAL_MS) { partialLastAtRef.current = now; requestPartialTranscript(recorder.mimeType) }
      }
      recorder.onstop = () => { stream.getTracks().forEach(track => track.stop()); setRecording(false); setBlob(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })) }
      recorderRef.current = recorder; recorder.start(1000); setRecording(true); timerRef.current = window.setTimeout(stop, maxSeconds * 1000)
    } catch { setError('Không truy cập được micro. Hãy cho phép quyền micro trong trình duyệt rồi thử lại.') }
  }, [maxSeconds, requestPartialTranscript, stop])
  const reset = useCallback(() => {
    clearTimer(); const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') { recorder.onstop = () => recorder.stream.getTracks().forEach(track => track.stop()); recorder.stop(); setRecording(false) }
    partialVersionRef.current += 1; setBlob(null); setError(null); setLiveTranscript('')
  }, [])
  useEffect(() => {
    if (!recording) return
    const host = document.createElement('div'), root = createRoot(host)
    document.body.appendChild(host); indicatorRootRef.current = root
    root.render(createElement(ListeningIndicator, { transcript: liveTranscript }))
    return () => { indicatorRootRef.current = null; root.unmount(); host.remove() }
  }, [recording])
  useEffect(() => { indicatorRootRef.current?.render(createElement(ListeningIndicator, { transcript: liveTranscript })) }, [liveTranscript])
  useEffect(() => () => reset(), [reset])
  return { recording, blob, error, start, stop, reset }
}
