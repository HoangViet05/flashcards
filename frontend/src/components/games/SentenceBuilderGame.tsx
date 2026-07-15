import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card } from '../../types'
import { englishPart, qualityFor, shuffle, type GameOutcome } from './gameUtils'

interface Props { card: Card; onFinish: (outcome: Omit<GameOutcome, 'cardId'>) => void }
const MAX_FREE = 12
const WINDOW = 8

export default function SentenceBuilderGame({ card, onFinish }: Props) {
  const words = useMemo(() => englishPart(card.example_sentence ?? '').split(/\s+/), [card])
  const range = useMemo(() => words.length <= MAX_FREE ? { start: 0, end: words.length } : { start: Math.floor((words.length - WINDOW) / 2), end: Math.floor((words.length - WINDOW) / 2) + WINDOW }, [words])
  const answer = useMemo(() => words.slice(range.start, range.end), [words, range])
  const [pool, setPool] = useState<{ word: string; key: number }[]>([])
  const [placed, setPlaced] = useState<{ word: string; key: number }[]>([])
  const [attempts, setAttempts] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [wrong, setWrong] = useState(false)
  const startedAt = useRef(Date.now())

  useEffect(() => { setPool(shuffle(answer.map((word, key) => ({ word, key })))); setPlaced([]); setAttempts(0); setRevealed(false); startedAt.current = Date.now() }, [card.id, answer])
  const check = () => {
    const next = attempts + 1
    setAttempts(next)
    if (placed.map(item => item.word).join(' ') === answer.join(' ')) onFinish({ quality: qualityFor(next, true), attempts: next, correct: true, timeMs: Date.now() - startedAt.current })
    else { setWrong(true); setTimeout(() => setWrong(false), 500) }
  }
  const giveUp = () => { setRevealed(true); setTimeout(() => onFinish({ quality: 1, attempts: attempts + 1, correct: false, timeMs: Date.now() - startedAt.current }), 1800) }
  return <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-5">
    <p className="mb-1 text-xs font-black uppercase text-slate-500">Xếp từ thành câu ví dụ của:</p><h3 className="mb-4 text-lg font-black text-cyan-300">{card.front_text}</h3>
    <div className={`mb-4 min-h-14 rounded-xl border p-3 text-[15px] leading-8 ${wrong ? 'animate-pulse border-rose-400/60 bg-rose-500/10' : 'border-white/10 bg-black/25'}`}>
      {range.start > 0 && <span className="text-slate-400">{words.slice(0, range.start).join(' ')} </span>}
      {revealed ? <span className="font-bold text-emerald-300">{answer.join(' ')}</span> : placed.map(item => <button key={item.key} onClick={() => { setPlaced(value => value.filter(x => x.key !== item.key)); setPool(value => [...value, item]) }} className="mx-0.5 rounded-lg bg-cyan-400/15 px-2 py-0.5 font-bold text-cyan-200">{item.word}</button>)}
      {!revealed && placed.length < answer.length && <span className="mx-1 text-slate-600">___</span>}
      {range.end < words.length && <span className="text-slate-400"> {words.slice(range.end).join(' ')}</span>}
    </div>
    <div className="mb-5 flex flex-wrap gap-2">{pool.map(item => <button key={item.key} onClick={() => { setPool(value => value.filter(x => x.key !== item.key)); setPlaced(value => [...value, item]) }} className="rounded-xl border border-white/10 bg-white/[.06] px-3 py-1.5 text-sm font-bold text-slate-100">{item.word}</button>)}</div>
    <div className="flex gap-2"><button onClick={check} disabled={placed.length !== answer.length || revealed} className="flex-1 rounded-xl border border-emerald-300/25 bg-emerald-400/10 py-2.5 text-sm font-bold text-emerald-200 disabled:opacity-40">Kiểm tra</button><button onClick={giveUp} disabled={revealed} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-400 disabled:opacity-40">Bỏ qua</button></div>
  </div>
}
