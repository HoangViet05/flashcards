import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { completeLearning, getDailySession, postDailyAnswer } from '../api/daily'
import { useNotification } from '../components/NotificationProvider'
import type { DailySession, DailyWord } from '../types'
export type Phase = 'review' | 'flip' | 'dictation' | 'split' | 'game' | 'done' | 'empty'
export type QueueName = 'review' | 'flip' | 'dictation' | 'left' | 'right'
type Queues = Record<QueueName, DailyWord[]>
const empty: Queues = { review: [], flip: [], dictation: [], left: [], right: [] }
const pending = (word: DailyWord, step: string) => !word.steps_done.includes(step)
export function useDailySession() {
  const { toast } = useNotification(); const [loading, setLoading] = useState(true); const [session, setSession] = useState<DailySession | null>(null); const [phase, setPhase] = useState<Phase>('review'); const [queues, setQueues] = useState<Queues>(empty); const [presented, setPresented] = useState(0); const [justFinished, setJustFinished] = useState(false); const startedAt = useRef(Date.now())
  useEffect(() => { getDailySession().then(loaded => { setSession(loaded); if (!loaded) { setPhase('empty'); return }; if (loaded.status !== 'learning') { setPhase(loaded.status === 'game' ? 'game' : 'done'); return }; setQueues({ review: loaded.words.filter(word => !word.is_new && pending(word, word.assigned_step)), flip: loaded.words.filter(word => word.is_new && pending(word, 'flip')), dictation: loaded.words.filter(word => word.is_new && pending(word, 'dictation')), left: loaded.words.filter(word => word.is_new && word.assigned_step === 'vi_en' && pending(word, 'vi_en')), right: loaded.words.filter(word => word.is_new && word.assigned_step === 'en_vi' && pending(word, 'en_vi')) }); setPhase(loaded.phase) }).catch(() => toast('Không tải được phiên học hôm nay', 'error')).finally(() => setLoading(false)) }, [toast])
  const finishLearning = useCallback(() => { void completeLearning().then(next => { setSession(next); setJustFinished(true); setPhase('game') }).catch(() => toast('Không hoàn tất được phần học', 'error')) }, [toast])
  const answer = useCallback((name: QueueName, step: string, correct: boolean) => { const [word, ...rest] = queues[name]; if (!word) return; void postDailyAnswer(word.card_id, step, correct).then(() => { const following = correct ? rest : [...rest, word]; setQueues(current => ({ ...current, [name]: following })); setPresented(value => value + 1); if (!following.length && name === 'flip') setPhase('dictation'); if (!following.length && name === 'dictation') setPhase('split') }).catch(() => toast('Không lưu được câu trả lời', 'error')) }, [queues, toast])
  const splitDone = !queues.left.length && !queues.right.length
  useEffect(() => { if (phase === 'split' && splitDone && session) finishLearning() }, [phase, splitDone, session, finishLearning])
  const beginNew = useCallback(() => { if (queues.flip.length) setPhase('flip'); else if (queues.dictation.length) setPhase('dictation'); else if (!splitDone) setPhase('split'); else finishLearning() }, [queues.flip.length, queues.dictation.length, splitDone, finishLearning])
  const { stepsDone, stepsTotal } = useMemo(() => { const words = session?.words ?? []; const total = words.reduce((sum, word) => sum + (word.is_new ? 3 : 1), 0); const done = words.reduce((sum, word) => sum + word.steps_done.length, 0); return { stepsDone: Math.min(done + presented, total), stepsTotal: total } }, [session, presented])
  return { loading, session, phase, queues, presented, stepsDone, stepsTotal, startedAt: startedAt.current, justFinished, setJustFinished, answer, beginNew, finishLearning, setPhase }
}
