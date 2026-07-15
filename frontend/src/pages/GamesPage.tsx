import { useEffect, useState } from 'react'
import { getDecks } from '../api/decks'
import { getGameCards } from '../api/games'
import { submitReview } from '../api/review'
import { useNotification } from '../components/NotificationProvider'
import ConceptMatchGame from '../components/games/ConceptMatchGame'
import DictationClozeGame from '../components/games/DictationClozeGame'
import SentenceBuilderGame from '../components/games/SentenceBuilderGame'
import { RATING_SOURCE, type GameOutcome } from '../components/games/gameUtils'
import type { Card, Deck, GameMode } from '../types'

const GAMES: { mode: GameMode; title: string; desc: string; icon: string }[] = [
  { mode: 'sentence', title: 'Sentence Builder', desc: 'Xếp từ thành câu ví dụ hoàn chỉnh', icon: '🧩' },
  { mode: 'cloze', title: 'Dictation Cloze', desc: 'Nghe câu và điền từ vựng còn thiếu', icon: '🎧' },
  { mode: 'match', title: 'Concept Match', desc: 'Nối từ với định nghĩa tiếng Anh', icon: '🔗' },
]
const MATCH_SIZE = 5
type Phase = 'setup' | 'loading' | 'playing' | 'done'

export default function GamesPage() {
  const { toast } = useNotification(); const [phase, setPhase] = useState<Phase>('setup'); const [mode, setMode] = useState<GameMode>('sentence')
  const [scope, setScope] = useState('due'); const [decks, setDecks] = useState<Deck[]>([]); const [cards, setCards] = useState<Card[]>([]); const [index, setIndex] = useState(0); const [outcomes, setOutcomes] = useState<GameOutcome[]>([])
  useEffect(() => { void getDecks().then(setDecks).catch(() => toast('Không tải được danh sách bộ thẻ', 'error')) }, [toast])
  const start = async (nextMode: GameMode) => { setMode(nextMode); setPhase('loading'); try { const fetched = await getGameCards(nextMode, { deckId: scope === 'due' ? undefined : scope }); if (!fetched.length) { toast('Không có thẻ phù hợp cho game này', 'warning'); setPhase('setup'); return }; setCards(fetched); setIndex(0); setOutcomes([]); setPhase('playing') } catch { toast('Không tải được thẻ', 'error'); setPhase('setup') } }
  const submit = (outcome: GameOutcome) => void submitReview(outcome.cardId, { quality: outcome.quality, rating_source: RATING_SOURCE[mode], response_time_ms: outcome.timeMs, attempt_count: outcome.attempts, answer_correct: outcome.correct }).catch(() => toast('Không lưu được kết quả 1 thẻ', 'error'))
  const finishSingle = (outcome: Omit<GameOutcome, 'cardId'>) => { const value = { ...outcome, cardId: cards[index].id }; submit(value); setOutcomes(items => [...items, value]); if (index + 1 < cards.length) setIndex(index + 1); else setPhase('done') }
  const finishMatch = (values: GameOutcome[]) => { values.forEach(submit); setOutcomes(items => [...items, ...values]); if ((index + 1) * MATCH_SIZE < cards.length) setIndex(index + 1); else setPhase('done') }
  return <div className="mx-auto max-w-2xl px-4 py-8"><h1 className="mb-6 text-2xl font-black text-white">🎮 Mini-games</h1>
    {phase === 'setup' && <><div className="mb-5 rounded-2xl border border-white/[.07] bg-white/[.03] p-4"><label className="mb-2 block text-xs font-black uppercase text-slate-500">Phạm vi thẻ</label><select value={scope} onChange={event => setScope(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"><option value="due">🔥 Thẻ đến hạn hôm nay</option>{decks.map(deck => <option key={deck.id} value={deck.id}>{deck.name} ({deck.card_count} thẻ)</option>)}</select></div><div className="space-y-3">{GAMES.map(game => <button key={game.mode} onClick={() => void start(game.mode)} className="flex w-full items-center gap-4 rounded-2xl border border-white/[.07] bg-white/[.03] p-4 text-left hover:border-cyan-300/25 hover:bg-white/[.06]"><span className="text-3xl">{game.icon}</span><span><span className="block font-black text-slate-100">{game.title}</span><span className="block text-sm text-slate-400">{game.desc}</span></span></button>)}</div></>}
    {phase === 'loading' && <div className="h-48 animate-pulse rounded-2xl bg-white/[.05]" />}
    {phase === 'playing' && mode !== 'match' && <><p className="mb-3 text-sm text-slate-400">Thẻ {index + 1}/{cards.length}</p>{mode === 'sentence' ? <SentenceBuilderGame key={cards[index].id} card={cards[index]} onFinish={finishSingle} /> : <DictationClozeGame key={cards[index].id} card={cards[index]} onFinish={finishSingle} />}</>}
    {phase === 'playing' && mode === 'match' && <><p className="mb-3 text-sm text-slate-400">Vòng {index + 1}/{Math.ceil(cards.length / MATCH_SIZE)}</p><ConceptMatchGame key={index} cards={cards.slice(index * MATCH_SIZE, (index + 1) * MATCH_SIZE)} onComplete={finishMatch} /></>}
    {phase === 'done' && <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-5"><h2 className="mb-1 text-xl font-black text-white">🏁 Kết quả</h2><p className="mb-4 text-sm text-slate-400">Đúng ngay: {outcomes.filter(item => item.quality === 5).length} · Đúng sau khi sai: {outcomes.filter(item => item.quality === 3).length} · Bỏ qua: {outcomes.filter(item => item.quality === 1).length}</p><p className="mb-4 text-xs text-slate-500">Kết quả đã được tính vào lịch ôn tập SM-2.</p><div className="flex gap-2"><button onClick={() => void start(mode)} className="flex-1 rounded-xl border border-cyan-300/25 bg-cyan-400/10 py-2.5 text-sm font-bold text-cyan-200">🔄 Chơi tiếp</button><button onClick={() => setPhase('setup')} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-400">Chọn game khác</button></div></div>}
  </div>
}
