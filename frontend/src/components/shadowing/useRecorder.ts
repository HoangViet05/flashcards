import { useCallback, useEffect, useRef, useState } from 'react'

export function useRecorder(maxSeconds = 20) {
  const [recording, setRecording] = useState(false), [blob, setBlob] = useState<Blob | null>(null), [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null), timerRef = useRef<number | null>(null), chunksRef = useRef<BlobPart[]>([])
  const clearTimer = () => { if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null } }
  const stop = useCallback(() => { clearTimer(); const recorder = recorderRef.current; if (recorder && recorder.state !== 'inactive') recorder.stop() }, [])
  const start = useCallback(async () => {
    setError(null); setBlob(null); chunksRef.current = []
    try {
      const testApi = window as typeof window & { __flashieRecorderApi?: { getUserMedia: () => Promise<MediaStream>; MediaRecorder: typeof MediaRecorder } }
      const media = testApi.__flashieRecorderApi ?? { getUserMedia: () => navigator.mediaDevices.getUserMedia({ audio: true }), MediaRecorder }
      const stream = await media.getUserMedia(), type = media.MediaRecorder.isTypeSupported?.('audio/webm') ? 'audio/webm' : undefined, recorder = new media.MediaRecorder(stream, type ? { mimeType: type } : undefined)
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => { stream.getTracks().forEach(track => track.stop()); setRecording(false); setBlob(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })) }
      recorderRef.current = recorder; recorder.start(1000); setRecording(true); timerRef.current = window.setTimeout(stop, maxSeconds * 1000)
    } catch { setError('Không truy cập được micro. Hãy cho phép quyền micro trong trình duyệt rồi thử lại.') }
  }, [maxSeconds, stop])
  const reset = useCallback(() => {
    clearTimer(); const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') { recorder.onstop = () => recorder.stream.getTracks().forEach(track => track.stop()); recorder.stop(); setRecording(false) }
    setBlob(null); setError(null)
  }, [])
  useEffect(() => () => reset(), [reset])
  return { recording, blob, error, start, stop, reset }
}
