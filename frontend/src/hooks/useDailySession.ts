import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { completeLearning, getDailySession, postDailyAnswer } from '../api/daily'
import { useNotification } from '../components/NotificationProvider'
import { useShadowingWorker } from './useShadowingWorker'
import type { DailySession, DailyWord } from '../types'

export type Phase = 'review' | 'weak' | 'speak' | 'flip' | 'dictation' | 'split' | 'game' | 'done' | 'empty'
export type QueueName = 'review' | 'weak' | 'flip' | 'dictation' | 'left' | 'right'

type Queues = Record<QueueName, DailyWord[]>

const EMPTY_QUEUES: Queues = { review: [], weak: [], flip: [], dictation: [], left: [], right: [] }

const pending = (word: DailyWord, step: string) => !word.steps_done.includes(step)

/** Giai đoạn kế tiếp khi một hàng đợi vừa cạn. Hàng `review` và hai bên của màn
 *  chia đôi không tự chuyển: `review` chờ người học bấm tiếp, còn màn chia đôi
 *  kết thúc bằng effect gọi `finishLearning`. */
const nextPhaseAfter = (name: QueueName): Phase | null => {
  if (name === 'weak') return 'speak'
  if (name === 'flip') return 'dictation'
  if (name === 'dictation') return 'split'
  return null
}

export function useDailySession(mode: 'full' | 'quick' = 'full') {
  const { toast } = useNotification()
  const worker = useShadowingWorker()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<DailySession | null>(null)
  const [phase, setPhase] = useState<Phase>('review')
  const [queues, setQueues] = useState<Queues>(EMPTY_QUEUES)
  const [presented, setPresented] = useState(0)
  const [justFinished, setJustFinished] = useState(false)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    getDailySession(mode)
      .then(loaded => {
        setSession(loaded)
        if (!loaded) {
          setPhase('empty')
          return
        }
        if (loaded.status !== 'learning') {
          setPhase(loaded.status === 'game' ? 'game' : 'done')
          return
        }
        setQueues({
          review: loaded.words.filter(word => !word.is_new && !word.is_weak && pending(word, word.assigned_step)),
          weak: loaded.words.filter(word => word.is_weak && pending(word, word.assigned_step)),
          flip: loaded.words.filter(word => word.is_new && pending(word, 'flip')),
          dictation: loaded.words.filter(word => word.is_new && pending(word, 'dictation')),
          left: loaded.words.filter(word => word.is_new && word.assigned_step === 'vi_en' && pending(word, 'vi_en')),
          right: loaded.words.filter(word => word.is_new && word.assigned_step === 'en_vi' && pending(word, 'en_vi')),
        })
        setPhase(loaded.phase as Phase)
        const pendingReview = loaded.words.some(word => !word.is_new && !word.is_weak && pending(word, word.assigned_step))
        const pendingWeak = loaded.words.some(word => word.is_weak && pending(word, word.assigned_step))
        if (loaded.phase === 'review' && !pendingReview && pendingWeak) setPhase('weak')
      })
      .catch(() => toast('Không tải được phiên học hôm nay', 'error'))
      .finally(() => setLoading(false))
  }, [toast, mode])

  const finishLearning = useCallback(() => {
    void completeLearning(mode)
      .then(next => {
        // Nhận lại phiên đã cập nhật để màn tổng kết đếm trên số liệu mới nhất.
        setSession(next)
        setJustFinished(true)
        setPhase('game')
      })
      .catch(() => toast('Không hoàn tất được phần học', 'error'))
  }, [toast, mode])

  /** Trả lời đúng thì bỏ từ khỏi hàng; sai thì đẩy xuống cuối để gặp lại. */
  const answer = useCallback((name: QueueName, step: string, correct: boolean) => {
    const [word, ...rest] = queues[name]
    if (!word) return

    void postDailyAnswer(word.card_id, step, correct, mode)
      .then(() => {
        const following = correct ? rest : [...rest, word]
        setQueues(current => ({ ...current, [name]: following }))
        setPresented(value => value + 1)

        let next = nextPhaseAfter(name)
        if (next === 'speak' && worker.status !== 'online') next = 'flip'
        if (!following.length && next) setPhase(next)
      })
      .catch(() => toast('Không lưu được câu trả lời', 'error'))
  }, [queues, toast, worker.status, mode])

  const splitDone = queues.left.length === 0 && queues.right.length === 0

  useEffect(() => {
    if (phase === 'split' && splitDone && session) finishLearning()
  }, [phase, splitDone, session, finishLearning])

  const beginNew = useCallback(() => {
    if (queues.weak.length) setPhase('weak')
    else if (worker.status === 'online' && session?.words.some(word => word.is_weak)) setPhase('speak')
    else if (queues.flip.length) setPhase('flip')
    else if (queues.dictation.length) setPhase('dictation')
    else if (!splitDone) setPhase('split')
    else finishLearning()
  }, [queues.weak.length, queues.flip.length, queues.dictation.length, splitDone, finishLearning, session, worker.status])

  const afterSpeak = useCallback(() => {
    if (queues.flip.length) setPhase('flip')
    else if (queues.dictation.length) setPhase('dictation')
    else if (!splitDone) setPhase('split')
    else finishLearning()
  }, [queues.flip.length, queues.dictation.length, splitDone, finishLearning])

  const { stepsDone, stepsTotal } = useMemo(() => {
    const words = session?.words ?? []
    const total = words.reduce((sum, word) => sum + (word.is_new ? 3 : 1), 0)
    const done = words.reduce((sum, word) => sum + word.steps_done.length, 0)
    // `presented` bù cho việc `session.words` không được tải lại sau mỗi câu;
    // `Math.min` chặn thanh tiến độ vượt tổng khi một từ bị trả lời sai nhiều lần.
    return { stepsDone: Math.min(done + presented, total), stepsTotal: total }
  }, [session, presented])

  return {
    loading,
    session,
    phase,
    queues,
    presented,
    stepsDone,
    stepsTotal,
    startedAt: startedAt.current,
    justFinished,
    setJustFinished,
    answer,
    beginNew,
    finishLearning,
    afterSpeak,
    speakWords: session?.words.filter(word => word.is_weak) ?? [],
    workerOnline: worker.status === 'online',
    setPhase,
  }
}
