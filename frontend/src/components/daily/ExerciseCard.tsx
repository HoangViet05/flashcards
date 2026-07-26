import { useEffect, useRef, useState } from 'react'

import type { Card, ExerciseStep } from '../../types'
import { playCardAudio } from '../../utils/audio'
import { useAudio } from '../../providers/AudioProvider'

interface Props {
  card: Card
  mode: ExerciseStep
  onResult: (correct: boolean) => void
  onCorrectStreak?: (streak: number) => void
}

type State = 'answering' | 'correct' | 'wrong' | 'self_confirm'

const normalizeEn = (value: string) =>
  value.trim().toLowerCase().replace(/[.,!?;:()[\]{}"']/g, '').replace(/\s+/g, ' ')

const normalizeVi = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')

const PROMPTS: Record<ExerciseStep, string> = {
  dictation: 'Nghe và gõ lại từ',
  vi_en: 'Việt → Anh · gõ từ tiếng Anh',
  en_vi: 'Anh → Việt · gõ nghĩa tiếng Việt',
}

/** Giữ màn "Chính xác" đủ lâu để người học kịp thấy trước khi sang câu sau. */
const CORRECT_HOLD_MS = 700

export default function ExerciseCard({ card, mode, onResult, onCorrectStreak }: Props) {
  const { feedback } = useAudio()
  const [typed, setTyped] = useState('')
  const [state, setState] = useState<State>('answering')
  const streak = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setTyped('')
    setState('answering')
    if (mode === 'dictation') playCardAudio(card)

    return () => {
      window.speechSynthesis.cancel()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [card.id, mode])

  const succeed = () => {
    streak.current += 1
    onCorrectStreak?.(streak.current)
    feedback(streak.current >= 3 ? 'combo' : 'correct')
    setState('correct')
    timer.current = setTimeout(() => onResult(true), CORRECT_HOLD_MS)
  }

  const fail = (next: 'wrong' | 'self_confirm') => {
    streak.current = 0
    onCorrectStreak?.(0)
    feedback('wrong')
    setState(next)
  }

  const check = () => {
    if (mode === 'en_vi') {
      // Nghĩa tiếng Việt khớp mềm: trùng một phần cũng tính đúng, còn lại để người học tự xác nhận.
      const answer = normalizeVi(typed)
      const expected = normalizeVi(card.back_text)
      if (answer.length >= 2 && (expected.includes(answer) || answer.includes(expected))) succeed()
      else fail('self_confirm')
      return
    }

    if (normalizeEn(typed) === normalizeEn(card.front_text)) succeed()
    else fail('wrong')
  }

  const answer = mode === 'en_vi' ? card.back_text : card.front_text

  const frame =
    state === 'correct' ? 'border-correct/60 bg-correct/10'
      : state === 'wrong' ? 'border-wrong/60 bg-wrong/10 animate-answer-shake'
        : 'border-subtle bg-surface-1'

  return (
    <div className={`rounded-2xl border p-5 transition-colors ${frame}`}>
      <p className="mb-3 text-xs font-black uppercase tracking-wider text-muted">{PROMPTS[mode]}</p>

      {mode === 'dictation' && (
        <button
          onClick={() => playCardAudio(card)}
          className="mb-4 min-h-[44px] rounded-xl border border-subtle bg-surface-2 px-4 text-sm font-bold text-accent-2"
        >
          Nghe lại
        </button>
      )}

      {mode === 'vi_en' && <p className="mb-4 rounded-xl bg-black/25 p-3 text-body">{card.back_text}</p>}

      {mode === 'en_vi' && (
        <p className="mb-4 flex items-center gap-3 rounded-xl bg-black/25 p-3 text-body">
          <b className="text-strong-text">{card.front_text}</b>
          <button onClick={() => playCardAudio(card)} className="text-accent-2" aria-label="Phát âm">Nghe</button>
        </p>
      )}

      {state === 'answering' && (
        <>
          <input
            autoFocus
            value={typed}
            onChange={event => setTyped(event.target.value)}
            onFocus={event => event.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
            onKeyDown={event => event.key === 'Enter' && typed.trim() && check()}
            placeholder={mode === 'en_vi' ? 'Gõ nghĩa tiếng Việt...' : 'Gõ từ tiếng Anh...'}
            className="mb-4 w-full rounded-xl border border-subtle bg-black/30 px-3 py-3 text-strong-text"
          />
          <button
            disabled={!typed.trim()}
            onClick={check}
            className="min-h-[44px] w-full rounded-xl bg-accent text-sm font-bold text-white disabled:opacity-40"
          >
            Kiểm tra
          </button>
        </>
      )}

      {state === 'correct' && (
        <div className="min-h-[44px] rounded-xl bg-correct/15 px-4 py-3 text-sm font-bold text-correct" role="status">
          Chính xác{streak.current >= 3 ? ` · chuỗi ${streak.current} câu đúng` : ''}
        </div>
      )}

      {state === 'wrong' && (
        <div>
          <p className="mb-2 text-sm font-bold text-wrong">Chưa đúng. Đáp án:</p>
          <p className="mb-4 rounded-xl bg-black/25 p-3 font-bold text-correct">{answer}</p>
          <button
            autoFocus
            onClick={() => onResult(false)}
            className="min-h-[44px] w-full rounded-xl border border-subtle bg-surface-2 text-sm font-bold text-body"
          >
            Tiếp tục
          </button>
        </div>
      )}

      {state === 'self_confirm' && (
        <div>
          <p className="mb-2 text-sm text-body">Đáp án trong thẻ:</p>
          <p className="mb-4 rounded-xl bg-black/25 p-3 font-bold text-correct">{card.back_text}</p>
          <p className="mb-3 text-sm text-muted">Câu trả lời của bạn: “{typed}” — bạn có đúng không?</p>
          <div className="flex gap-2">
            <button
              onClick={() => onResult(true)}
              className="min-h-[44px] flex-1 rounded-xl border border-correct/30 bg-correct/10 text-sm font-bold text-correct"
            >
              Tôi đúng
            </button>
            <button
              onClick={() => onResult(false)}
              className="min-h-[44px] flex-1 rounded-xl border border-wrong/30 bg-wrong/10 text-sm font-bold text-wrong"
            >
              Tôi sai
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
