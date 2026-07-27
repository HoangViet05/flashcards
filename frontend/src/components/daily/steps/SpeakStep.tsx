import { useEffect, useRef, useState } from 'react'

import { createShadowAttempt } from '../../../api/shadowing'
import { scoreRecording } from '../../../api/shadowingWorker'
import { useFeedback } from '../../../hooks/useFeedback'
import type { DailyWord, ShadowScore } from '../../../types'
import { useNotification } from '../../NotificationProvider'
import ScoreDisplay from '../../shadowing/ScoreDisplay'
import { Mp3Player, TtsPlayer, type PlayerHandle } from '../../shadowing/SegmentPlayer'
import { useRecorder } from '../../shadowing/useRecorder'

interface Props {
  words: DailyWord[]
  onDone: () => void
}

/** Ngưỡng đạt của một lần nói. Cùng mốc mà ScoreDisplay dùng để tô màu xanh. */
const PASS_SCORE = 80

export default function SpeakStep({ words, onDone }: Props) {
  const { toast } = useNotification()
  const fb = useFeedback()
  const recorder = useRecorder()
  const playerRef = useRef<PlayerHandle | null>(null)
  const scoreRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState<ShadowScore | null>(null)
  const [scoring, setScoring] = useState(false)
  const word = words[index]
  const target = word?.card.example_sentence?.trim() || word?.card.front_text || ''

  useEffect(() => {
    if (!recorder.blob || !target || !word) return
    setScoring(true)
    void scoreRecording(recorder.blob, target)
      .then(score => {
        setResult(score)
        if (!score.no_speech) {
          if (score.score >= PASS_SCORE) fb.correct(scoreRef.current)
          else fb.wrong(scoreRef.current)
          void createShadowAttempt({
            source_type: 'card', card_id: word.card_id, article_id: null, video_id: null,
            segment_index: null, target_text: target, transcript: score.transcript,
            score: score.score, word_results: score.words,
          }).catch(() => undefined)
        }
      })
      .catch(() => toast('Không chấm được điểm — kiểm tra máy chấm', 'error'))
      .finally(() => setScoring(false))
  }, [fb, recorder.blob, target, toast, word])

  if (!word) return null

  const next = () => {
    playerRef.current?.stop()
    recorder.reset()
    setResult(null)
    if (index + 1 < words.length) setIndex(index + 1)
    else onDone()
  }

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted">Nói lại · câu {index + 1}/{words.length}</p>
        <button onClick={onDone} className="min-h-[44px] text-xs font-bold text-muted underline">Bỏ qua bước nói</button>
      </div>
      {word.card.example_audio_url
        ? <Mp3Player ref={playerRef} src={word.card.example_audio_url} rate={1} />
        : <TtsPlayer ref={playerRef} text={target} rate={1} />}
      <div className="rounded-2xl border border-subtle bg-surface-1 p-5 text-center">
        <p className="text-lg font-bold leading-8 text-strong-text">{target}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button onClick={() => playerRef.current?.play()} className="min-h-[44px] rounded-xl border border-subtle bg-surface-2 px-4 text-sm font-bold text-accent-2">Nghe mẫu</button>
          <button disabled={scoring} onClick={() => (recorder.recording ? recorder.stop() : void recorder.start())} className="min-h-[44px] rounded-xl bg-accent px-5 text-sm font-bold text-white disabled:opacity-40">{recorder.recording ? 'Dừng' : 'Nói'}</button>
        </div>
        {recorder.error && <p className="mt-3 text-sm text-wrong">{recorder.error}</p>}
      </div>
      {scoring && <div className="h-20 animate-pulse rounded-2xl bg-surface-2" />}
      {result && !scoring && <div ref={scoreRef}><ScoreDisplay result={result} /></div>}
      <button onClick={next} className="min-h-[44px] w-full rounded-xl border border-subtle bg-surface-2 text-sm font-bold text-body">{index + 1 < words.length ? 'Câu tiếp' : 'Xong phần nói'}</button>
    </section>
  )
}
