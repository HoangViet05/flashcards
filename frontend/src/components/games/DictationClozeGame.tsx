import { useEffect, useMemo, useRef, useState } from 'react'
import { resolveAssetUrl } from '../../api/config'
import type { Card } from '../../types'
import { cleanFront, englishPart, qualityFor, type GameOutcome } from './gameUtils'

interface Props { card: Card; onFinish: (outcome: Omit<GameOutcome, 'cardId'>) => void }

export default function DictationClozeGame({ card, onFinish }: Props) {
  const sentence = useMemo(() => englishPart(card.example_sentence ?? ''), [card])
  const target = useMemo(() => cleanFront(card.front_text), [card])
  const clozed = useMemo(() => sentence.replace(new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '_____'), [sentence, target])
  const [typed, setTyped] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [wrong, setWrong] = useState(false)
  const startedAt = useRef(Date.now())
  const audio = useRef<HTMLAudioElement | null>(null)
  const play = () => {
    const url = resolveAssetUrl(card.example_audio_url)
    if (url) { audio.current?.pause(); audio.current = new Audio(url); void audio.current.play().catch(() => {}) }
    else { window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(sentence); utterance.lang = 'en-US'; utterance.rate = .9; window.speechSynthesis.speak(utterance) }
  }
  useEffect(() => { setTyped(''); setAttempts(0); setRevealed(false); startedAt.current = Date.now(); play(); return () => { audio.current?.pause(); window.speechSynthesis.cancel() } }, [card.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const check = () => {
    const next = attempts + 1; setAttempts(next)
    if (typed.trim().toLowerCase() === target) onFinish({ quality: qualityFor(next, true), attempts: next, correct: true, timeMs: Date.now() - startedAt.current })
    else { setWrong(true); setTimeout(() => setWrong(false), 500) }
  }
  const giveUp = () => { setRevealed(true); setTimeout(() => onFinish({ quality: 1, attempts: attempts + 1, correct: false, timeMs: Date.now() - startedAt.current }), 1800) }
  return <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-5">
    <p className="mb-4 text-xs font-black uppercase text-slate-500">Nghe và điền từ còn thiếu</p>
    <button onClick={play} className="mb-4 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200">🔊 Nghe lại</button>
    <p className="mb-4 rounded-xl bg-black/25 p-3 text-[15px] leading-7 text-slate-200">{revealed ? sentence : clozed}{revealed && <span className="ml-2 font-bold text-emerald-300">← {target}</span>}</p>
    <input value={typed} onChange={event => setTyped(event.target.value)} onKeyDown={event => event.key === 'Enter' && typed.trim() && !revealed && check()} placeholder="Gõ từ còn thiếu..." autoFocus className={`mb-4 w-full rounded-xl border bg-black/30 px-3 py-2.5 text-white placeholder:text-slate-500 ${wrong ? 'animate-pulse border-rose-400/60' : 'border-white/10'}`} />
    <div className="flex gap-2"><button onClick={check} disabled={!typed.trim() || revealed} className="flex-1 rounded-xl border border-emerald-300/25 bg-emerald-400/10 py-2.5 text-sm font-bold text-emerald-200 disabled:opacity-40">Kiểm tra</button><button onClick={giveUp} disabled={revealed} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-400 disabled:opacity-40">Bỏ qua</button></div>
  </div>
}
