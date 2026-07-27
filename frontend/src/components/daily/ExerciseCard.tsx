import { useEffect, useRef, useState } from 'react'

import type { Card, ExerciseStep } from '../../types'
import { useFeedback } from '../../hooks/useFeedback'
import { playCardAudio } from '../../utils/audio'

interface Props { card: Card; mode: ExerciseStep; onResult: (correct: boolean) => void; onCorrectStreak?: (streak: number) => void }
type State = 'answering' | 'correct' | 'wrong' | 'self_confirm'
const CORRECT_HOLD_MS = 700
const normalizeEn = (value: string) => value.trim().toLowerCase().replace(/[.,!?;:()[\]{}"']/g, '').replace(/\s+/g, ' ')
const normalizeVi = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')
const prompts: Record<ExerciseStep, string> = { dictation: 'Listen and type the word', vi_en: 'Meaning to English', en_vi: 'English to meaning' }

/** One real SM-2 answer surface; feedback remains visible before advancing. */
export default function ExerciseCard({ card, mode, onResult, onCorrectStreak }: Props) {
  const fb = useFeedback()
  const [typed, setTyped] = useState('')
  const [state, setState] = useState<State>('answering')
  const streak = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => { setTyped(''); setState('answering'); if (mode === 'dictation') playCardAudio(card); return () => { window.speechSynthesis.cancel(); if (timer.current) clearTimeout(timer.current) } }, [card.id, mode])
  const succeed = () => { streak.current += 1; onCorrectStreak?.(streak.current); fb.combo(streak.current, cardRef.current); setState('correct'); timer.current = setTimeout(() => onResult(true), CORRECT_HOLD_MS) }
  const fail = (next: 'wrong' | 'self_confirm') => { streak.current = 0; onCorrectStreak?.(0); fb.wrong(cardRef.current); setState(next) }
  const check = () => { if (mode === 'en_vi') { const answer = normalizeVi(typed); const expected = normalizeVi(card.back_text); if (answer.length >= 2 && (expected.includes(answer) || answer.includes(expected))) succeed(); else fail('self_confirm'); return } if (normalizeEn(typed) === normalizeEn(card.front_text)) succeed(); else fail('wrong') }
  const answer = mode === 'en_vi' ? card.back_text : card.front_text
  return <div ref={cardRef} className={`exercise-card exercise-card--${state}`} data-state={state}>
    <p className="exercise-card__prompt">{prompts[mode]}</p>
    {mode === 'dictation' && <button onClick={() => playCardAudio(card)} className="exercise-card__sound" aria-label="Play prompt">Play again</button>}
    {mode === 'vi_en' && <p className="exercise-card__cue">{card.back_text}</p>}
    {mode === 'en_vi' && <p className="exercise-card__cue"><b>{card.front_text}</b><button onClick={() => playCardAudio(card)} aria-label="Play pronunciation">Listen</button></p>}
    {state === 'answering' && <><input autoFocus value={typed} onChange={event => setTyped(event.target.value)} onFocus={event => event.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })} onKeyDown={event => event.key === 'Enter' && typed.trim() && check()} placeholder={mode === 'en_vi' ? 'Type the meaning' : 'Type the English word'} /><button disabled={!typed.trim()} onClick={check} className="exercise-card__primary">Check answer</button></>}
    {state === 'correct' && <div className="exercise-card__feedback exercise-card__feedback--correct" role="status">Correct{streak.current >= 3 ? ` · ${streak.current} in flow` : ''}</div>}
    {state === 'wrong' && <div className="exercise-card__feedback exercise-card__feedback--wrong"><p>Not quite. The answer is:</p><b>{answer}</b><button autoFocus onClick={() => onResult(false)}>Continue</button></div>}
    {state === 'self_confirm' && <div className="exercise-card__feedback exercise-card__feedback--wrong"><p>Compare with the card:</p><b>{card.back_text}</b><p>Your answer: “{typed}”</p><div><button onClick={() => onResult(true)}>I was right</button><button onClick={() => onResult(false)}>I was wrong</button></div></div>}
  </div>
}
