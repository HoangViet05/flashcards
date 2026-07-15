import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card } from '../../types'
import { shuffle, type GameOutcome } from './gameUtils'

interface Props { cards: Card[]; onComplete: (outcomes: GameOutcome[]) => void }

export default function ConceptMatchGame({ cards, onComplete }: Props) {
  const roundKey = cards.map(card => card.id).join(',')
  const rightItems = useMemo(() => shuffle(cards.map(card => ({ id: card.id, definition: card.definition ?? '' }))), [roundKey])
  const [left, setLeft] = useState<string | null>(null)
  const [solved, setSolved] = useState<Set<string>>(new Set())
  const [fails, setFails] = useState<Record<string, number>>({})
  const [shake, setShake] = useState<string | null>(null)
  const startedAt = useRef(Date.now())
  useEffect(() => { setLeft(null); setSolved(new Set()); setFails({}); startedAt.current = Date.now() }, [roundKey])
  const pickRight = (id: string) => {
    if (!left || solved.has(id)) return
    if (id !== left) { setFails(value => ({ ...value, [left]: (value[left] ?? 0) + 1 })); setShake(id); setTimeout(() => setShake(null), 400); return }
    const next = new Set(solved).add(id); setSolved(next); setLeft(null)
    if (next.size === cards.length) {
      const total = Date.now() - startedAt.current
      onComplete(cards.map(card => ({ cardId: card.id, quality: (fails[card.id] ?? 0) === 0 ? 5 : 3, attempts: (fails[card.id] ?? 0) + 1, correct: true, timeMs: Math.round(total / cards.length) })))
    }
  }
  return <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-5"><p className="mb-4 text-xs font-black uppercase text-slate-500">Nối từ với định nghĩa · {solved.size}/{cards.length}</p><div className="grid grid-cols-2 gap-3"><div className="space-y-2">{cards.map(card => <button key={card.id} onClick={() => !solved.has(card.id) && setLeft(card.id)} disabled={solved.has(card.id)} className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm font-bold ${solved.has(card.id) ? 'border-emerald-300/20 bg-emerald-400/5 text-emerald-300/50' : left === card.id ? 'border-cyan-300/50 bg-cyan-400/15 text-cyan-200' : 'border-white/10 bg-white/[.05] text-slate-100'}`}>{card.front_text}</button>)}</div><div className="space-y-2">{rightItems.map(item => <button key={item.id} onClick={() => pickRight(item.id)} disabled={solved.has(item.id)} className={`w-full rounded-xl border px-3 py-2.5 text-left text-xs leading-5 ${shake === item.id ? 'animate-pulse border-rose-400/60 bg-rose-500/10 text-rose-200' : solved.has(item.id) ? 'border-emerald-300/20 bg-emerald-400/5 text-emerald-300/50' : 'border-white/10 bg-white/[.05] text-slate-300'}`}>{item.definition}</button>)}</div></div>{!left && solved.size < cards.length && <p className="mt-3 text-center text-xs text-slate-500">Chọn một từ bên trái, rồi chọn định nghĩa khớp bên phải</p>}</div>
}
