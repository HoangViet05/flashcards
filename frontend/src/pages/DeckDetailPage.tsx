import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getDeck } from '../api/decks'
import { getAllCards, getCards, createCard, updateCard, deleteCard } from '../api/cards'
import { generateAIContent, generateAIBatchStream } from '../api/ai'
import { useNotification } from '../components/NotificationProvider'
import RobotAnimation from '../components/RobotAnimation'
import type { Deck, Card } from '../types'

// Tính năng AI tạm hoãn — bật lại khi phát hành các tính năng AI
const AI_ENABLED = false

type RobotAction = 'thinking' | 'add' | 'throw'

interface GlobalFlyingCardData {
  id: string;
  word: string;
  targetId: string;
  status?: 'success' | 'rejected';
}

function FlyingGlassCard({ data, onComplete }: { data: GlobalFlyingCardData, onComplete: () => void }) {
  const [style, setStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    top: '28%',
    left: '50%',
    transform: 'translate(-50%, -50%) scale(0.5) translateY(50px)',
    opacity: 0,
    zIndex: 9999,
    transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
    pointerEvents: 'none'
  });

  const isRejected = data.status === 'rejected';

  useEffect(() => {
    const rx = (Math.random() - 0.5) * 80;
    const ry = (Math.random() - 0.5) * 60;
    const rRot = (Math.random() - 0.5) * 20;

    const t1 = setTimeout(() => {
      setStyle(prev => ({
        ...prev,
        opacity: 1,
        transform: `translate(calc(-50% + ${rx}px), calc(-50% + ${ry}px)) scale(1) rotate(${rRot}deg)`,
      }));
    }, 50);

    const t2 = setTimeout(() => {
      if (isRejected) {
        setStyle(prev => ({
          ...prev,
          top: '100%',
          transform: 'translate(-50%, 100%) scale(0.6) rotate(-30deg)',
          opacity: 0,
          transition: 'all 0.6s cubic-bezier(0.5, 0, 0.2, 1)'
        }));
      } else {
        const target = document.getElementById(data.targetId);
        if (target) {
          const rect = target.getBoundingClientRect();
          const targetX = rect.left + 20;
          const targetY = rect.top + 10;

          setStyle(prev => ({
            ...prev,
            top: targetY + 'px',
            left: targetX + 'px',
            transform: 'translate(-50%, -50%) scale(0.1) rotate(45deg)',
            opacity: 0,
            transition: 'all 0.6s cubic-bezier(0.5, 0, 0.2, 1)'
          }));
        } else {
          setStyle(prev => ({ ...prev, opacity: 0, transform: 'translate(-50%, -50%) scale(0)' }));
        }
      }
    }, 1200);

    const t3 = setTimeout(() => {
      onComplete();
    }, 1900);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); }
  }, [data.targetId, isRejected, onComplete]);

  return (
    <div style={style} className={`glass px-8 py-10 rounded-3xl border shadow-[0_30px_60px_rgba(0,0,0,0.4)] bg-[#0f172a]/80 backdrop-blur-2xl flex flex-col items-center justify-center gap-4 ${isRejected ? 'border-red-500/30' : 'border-white/30'}`}>
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl border shadow-inner ${isRejected ? 'bg-gradient-to-br from-red-500/40 to-orange-500/30 border-red-500/60' : 'bg-gradient-to-br from-violet-500/40 to-fuchsia-500/30 border-violet-500/60 shadow-[0_0_20px_rgba(124,58,237,0.4)]'}`}>
        {isRejected ? '🚫' : '✨'}
      </div>
      <div className={`font-extrabold text-2xl tracking-tight text-center max-w-[200px] truncate ${isRejected ? 'text-red-200 line-through' : 'text-white'}`}>{data.word}</div>
      <div className={`font-bold text-xs py-1.5 px-4 rounded-full border ${isRejected ? 'text-red-300 bg-red-500/20 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'text-violet-300 bg-violet-500/20 border-violet-500/40 shadow-[0_0_15px_rgba(124,58,237,0.3)] animate-pulse'}`}>
        {isRejected ? 'Bỏ qua từ trùng' : '+1 thẻ mới'}
      </div>
    </div>
  );
}

export default function DeckDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [deck, setDeck] = useState<Deck | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [example, setExample] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')
  const [editExample, setEditExample] = useState('')

  const [aiCount, setAiCount] = useState(5)
  const [isBatchGenerating, setIsBatchGenerating] = useState(false)
  const [globalFlyingCards, setGlobalFlyingCards] = useState<GlobalFlyingCardData[]>([])
  const [robotAction, setRobotAction] = useState<RobotAction>('thinking')
  const [cardsCreatedInSession, setCardsCreatedInSession] = useState(0)
  const actionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { toast, confirm } = useNotification()

  const load = async () => {
    if (!id) return
    const [d, page] = await Promise.all([getDeck(id), getCards(id, { limit: 100, offset: 0 })])
    setDeck(d)
    setCards(page.items)
    setTotal(page.total)
  }

  const handleLoadMore = async () => {
    if (!id || loadingMore || cards.length >= total) return
    setLoadingMore(true)
    try {
      const page = await getCards(id, { limit: 100, offset: cards.length })
      setCards(previous => [...previous, ...page.items])
      setTotal(page.total)
    } finally {
      setLoadingMore(false)
    }
  }

  const handleGenerateAI = async () => {
    if (!AI_ENABLED) return
    if (!deck) return
    if (!front.trim()) {
      toast('Vui lòng nhập từ khóa vào mặt trước trước khi dùng AI', 'warning')
      return
    }

    setIsGenerating(true)
    try {
      const excludedWords = (await getAllCards(deck.id)).map(c => c.front_text)
      const result = await generateAIContent(front.trim(), excludedWords)
      setFront(result.front_text || front)
      setBack(result.back_text || '')
      setExample(result.example_sentence || '')
      toast('Tạo nội dung AI thành công!', 'success')
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Không thể tạo nội dung từ AI. Hãy kiểm tra Ollama."
      toast(msg, 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerateAIBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!AI_ENABLED || !deck) return

    setIsBatchGenerating(true)
    setCardsCreatedInSession(0)
    setRobotAction('thinking')
    try {
      let successCount = 0;
      const excludedWords = (await getAllCards(deck.id)).map(c => c.front_text)

      await generateAIBatchStream(deck.name, aiCount, excludedWords, async (card) => {
        try {
          const word = card.front_text || deck.name;
          // Ưu tiên sử dụng cờ is_duplicate từ backend vì backend đã làm sạch từ vựng chuyên sâu (loại bỏ phiên âm).
          // Fallback về frontend nếu backend trả thiếu.
          const isDuplicate = card.is_duplicate ?? excludedWords.some(w => w.toLowerCase() === word.toLowerCase());

          if (isDuplicate) {
            setGlobalFlyingCards(prev => [...prev, { id: Date.now() + '-' + Math.random(), word, targetId: 'deck-card-count-badge', status: 'rejected' }]);
            if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current)
            setRobotAction('throw')
            actionTimeoutRef.current = setTimeout(() => setRobotAction('thinking'), 1000)
          } else {
            await createCard(deck.id, {
              front_text: word,
              back_text: card.back_text || '',
              example_sentence: card.example_sentence || undefined
            });
            successCount++;
            setCardsCreatedInSession(prev => prev + 1)
            excludedWords.push(word);

            // Bắn thẻ bay ngay giữa màn hình
            setGlobalFlyingCards(prev => [...prev, { id: Date.now() + '-' + Math.random(), word, targetId: 'deck-card-count-badge', status: 'success' }]);

            if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current)
            setRobotAction('add')
            actionTimeoutRef.current = setTimeout(() => setRobotAction('thinking'), 1000)

            load() // Real-time update count on GUI
          }
        } catch (e) {
          console.warn("Lỗi khi thêm một thẻ:", e)
        }
      })

      if (successCount > 0) {
        toast(`Đã tạo thành công ${successCount} thẻ AI cho chủ đề "${deck.name}"`, 'success')
      } else {
        toast(`Không thể tạo thẻ nào, có thể chủ đề này đã có đầy đủ thẻ.`, 'info')
      }
    } catch (err: any) {
      console.error(err)
      toast("Không thể tạo từ AI. Vui lòng kiểm tra lại kết nối.", 'error')
    } finally {
      setIsBatchGenerating(false)
    }
  }

  useEffect(() => { load() }, [id])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !front.trim() || !back.trim()) return

    // Kiểm tra trùng lặp nhanh ở Frontend
    const isDuplicate = cards.some(c => c.front_text.toLowerCase() === front.trim().toLowerCase())
    if (isDuplicate) {
      toast(`Từ "${front.trim()}" đã tồn tại!`, 'warning')
      return
    }

    try {
      await createCard(id, {
        front_text: front.trim(),
        back_text: back.trim(),
        example_sentence: example.trim() || undefined,
      })
      toast('Đã thêm thẻ mới', 'success')
      setFront(''); setBack(''); setExample(''); setShowForm(false)
      load()
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Không thể tạo thẻ."
      toast(msg, 'error')
    }
  }

  const handleDelete = async (cardId: string) => {
    confirm({
      title: 'Xóa thẻ',
      message: 'Bạn có chắc chắn muốn xóa thẻ này khỏi bộ bài?',
      confirmText: 'Xóa thẻ',
      variant: 'danger',
      onConfirm: async () => {
        await deleteCard(cardId)
        toast('Đã xóa thẻ', 'success')
        load()
      }
    })
  }

  const handleStartEdit = (card: Card) => {
    setEditingId(card.id)
    setEditFront(card.front_text)
    setEditBack(card.back_text)
    setEditExample(card.example_sentence || '')
  }

  const handleUpdate = async () => {
    if (!editingId || !editFront.trim() || !editBack.trim()) return
    await updateCard(editingId, {
      front_text: editFront.trim(),
      back_text: editBack.trim(),
      example_sentence: editExample.trim() || undefined,
    })
    toast('Đã cập nhật thẻ', 'success')
    setEditingId(null)
    load()
  }

  if (!deck) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-gray-600">
        <div className="w-5 h-5 border-2 border-violet-500/50 border-t-violet-500 rounded-full animate-spin" />
        Đang tải...
      </div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

      {/* Global Flying Cards Layer */}
      {globalFlyingCards.map(fc => (
        <FlyingGlassCard
          key={fc.id}
          data={fc}
          onComplete={() => setGlobalFlyingCards(prev => prev.filter(c => c.id !== fc.id))}
        />
      ))}

      {/* Robot Animation Layer */}
      <RobotAnimation isVisible={isBatchGenerating} action={robotAction} />
      {/* Breadcrumb Capsule */}
      <div className="inline-flex items-center gap-2 sm:gap-3 mb-8 p-1.5 pr-5 bg-white/[0.02] border border-white/5 rounded-full backdrop-blur-md shadow-inner animate-fade-in-up hover:bg-white/[0.04] transition-colors">
        <Link to="/" className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all text-sm font-bold group">
          <span className="group-hover:scale-110 transition-transform">🗂️</span>
          <span className="hidden sm:inline">Tất cả bộ thẻ</span>
          <span className="sm:hidden">Quay lại</span>
        </Link>
        <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-cyan-300 text-sm font-extrabold tracking-wide truncate max-w-[150px] sm:max-w-xs">{deck.name}</span>
      </div>

      {/* Deck header */}
      <div className="relative rounded-[2rem] p-[1px] mb-10 overflow-hidden animate-fade-in-up" style={{ animationDelay: '60ms' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/50 via-purple-500/30 to-cyan-500/40 opacity-70 blur-md pointer-events-none" />
        <div className="relative glass rounded-[2rem] p-6 sm:p-8 flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-5 bg-black/40 backdrop-blur-xl border border-white/10 overflow-hidden">
          {/* Decorative glare */}
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-b from-white/10 to-transparent rotate-45 transform translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-50 mix-blend-overlay" />

          <div className="flex items-center gap-4 sm:gap-5 relative z-10 w-full sm:w-auto">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[1.25rem] bg-gradient-to-br from-violet-500/20 to-purple-600/30 border border-violet-500/40 flex items-center justify-center text-2xl sm:text-3xl shadow-[0_0_20px_rgba(139,92,246,0.3)] shrink-0">
              📚
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 truncate tracking-tight">{deck.name}</h1>
              {deck.description && <p className="text-gray-400 text-sm mt-1.5 line-clamp-2 leading-relaxed">{deck.description}</p>}
              <div className="flex items-center gap-2 mt-2.5">
                <span id="deck-card-count-badge" className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-gray-300 backdrop-blur-md shadow-inner">
                  {total} thẻ
                </span>

                {deck.new_count > 0 && (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-500/30" />
                    <span className="text-xs text-violet-300/80 font-medium">
                      {deck.new_count} mới
                    </span>
                  </>
                )}

                {deck.due_count > 0 && (
                    <>
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/30" />
                      <span className="text-xs text-cyan-300/80 font-medium">
                        {deck.due_count} cần ôn
                      </span>
                    </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0 relative z-10 w-full sm:w-auto mt-2 sm:mt-0">
            {(() => {
              const clozeCards = cards.filter(c => c.example_sentence && c.example_sentence.toLowerCase().includes(c.front_text.toLowerCase()));
              const reverseCards = cards.filter(c => c.back_text || c.image_url);
              const typedMode = deck.due_count > 0 ? 'review' : deck.new_count > 0 ? 'learn' : 'practice';

              return (
                <>
                  {deck.new_count > 0 && (
                    <Link
                      to={`/review?deckId=${deck.id}&mode=learn`}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(124,58,237,0.3)] transition-all hover:scale-[1.02]"
                    >
                      <span>✨</span> Học {deck.new_count} thẻ mới
                    </Link>
                  )}
                  {deck.due_count > 0 && (
                    <Link
                      to={`/review?deckId=${deck.id}&mode=review`}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 px-5 py-2.5 rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all hover:scale-[1.02]"
                    >
                      <span>🧠</span> Ôn tập {deck.due_count} thẻ
                    </Link>
                  )}
                  {total > 0 && (
                    <Link
                      to={`/review?deckId=${deck.id}&mode=practice`}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white/[0.05] hover:bg-white/[0.08] text-white border border-white/10 px-5 py-2.5 rounded-xl text-sm font-bold shadow-inner transition-all hover:scale-[1.02]"
                    >
                      <span>🔄</span> Lướt thẻ
                    </Link>
                  )}
                  {clozeCards.length > 0 && (
                    <Link
                      to={`/review?deckId=${deck.id}&mode=${typedMode}&type=cloze`}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 px-5 py-2.5 rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(245,158,11,0.1)] transition-all hover:scale-[1.02]"
                    >
                      <span>___</span> Cloze
                    </Link>
                  )}
                  {reverseCards.length > 0 && (
                    <Link
                      to={`/review?deckId=${deck.id}&mode=${typedMode}&type=reverse`}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 px-5 py-2.5 rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(20,184,166,0.1)] transition-all hover:scale-[1.02]"
                    >
                      <span>EN</span> Đảo ngược
                    </Link>
                  )}
                </>
              );
            })()}
            <button
              onClick={() => setShowForm(f => !f)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 btn-primary px-5 py-2.5 rounded-xl text-sm font-bold shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_25px_rgba(124,58,237,0.5)] hover:scale-[1.02] transition-all"
            >
              <span className="text-lg leading-none mb-0.5">+</span> Thêm thẻ
            </button>
          </div>
        </div>
      </div>

      {/* AI Batch Generator for this specific deck */}
      <div className="mb-10 relative rounded-[2rem] p-[1px] animate-fade-in-up" style={{ animationDelay: '90ms' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/30 via-blue-500/20 to-violet-500/30 opacity-70 blur-md pointer-events-none" />
        <div className="relative glass rounded-[2rem] p-5 sm:p-6 overflow-hidden bg-[#0f172a]/60 backdrop-blur-xl border border-white/10 flex flex-col md:flex-row items-center gap-5 justify-between">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <span className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(6,182,212,0.3)] shrink-0">✨</span>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Tạo lô thẻ AI cho chủ đề này
                {!AI_ENABLED && (
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-full">Sắp ra mắt ✨</span>
                )}
              </h2>
              <p className="text-gray-400 text-sm mt-0.5">
                {AI_ENABLED ? `Mở rộng bộ thẻ "${deck.name}" một cách thần tốc.` : 'Tính năng đang được hoàn thiện — sẽ sớm ra mắt.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleGenerateAIBatch} className={`flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto ${AI_ENABLED ? '' : 'opacity-60'}`}>
            <div className="flex items-center bg-white/[0.03] border border-white/10 rounded-xl p-1.5 transition-all hover:bg-white/[0.04] focus-within:bg-white/[0.05] focus-within:border-cyan-500/50 flex-1 md:flex-none">
              <span className="text-gray-500 text-sm font-medium ml-3 mr-2 whitespace-nowrap hidden sm:inline">Số thẻ bổ sung:</span>
              <span className="text-gray-500 text-sm font-medium ml-2 mr-1 whitespace-nowrap sm:hidden">SL:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAiCount(prev => Math.max(1, prev - 1))}
                  disabled={!AI_ENABLED || isBatchGenerating || aiCount <= 1}
                  className="w-9 h-9 rounded-[0.6rem] bg-white/[0.05] hover:bg-white/10 active:scale-95 flex items-center justify-center text-cyan-400 font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-inner"
                >–</button>
                <input
                  type="number"
                  min="1" max="50"
                  value={aiCount}
                  onChange={e => setAiCount(parseInt(e.target.value) || 5)}
                  className="w-10 bg-transparent text-cyan-100 font-bold text-lg text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  disabled={!AI_ENABLED || isBatchGenerating}
                />
                <button
                  type="button"
                  onClick={() => setAiCount(prev => Math.min(50, prev + 1))}
                  disabled={!AI_ENABLED || isBatchGenerating || aiCount >= 50}
                  className="w-9 h-9 rounded-[0.6rem] bg-white/[0.05] hover:bg-white/10 active:scale-95 flex items-center justify-center text-cyan-400 font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-inner"
                >+</button>
              </div>
            </div>
            <button
              type="submit"
              disabled={!AI_ENABLED || isBatchGenerating}
              className="btn-primary bg-cyan-600 hover:bg-cyan-500 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap w-full sm:w-auto"
            >
              {isBatchGenerating ? (
                <><div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />Đang tạo...</>
              ) : (
                <>Sinh thẻ 🪄</>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Add card form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowForm(false)} />
          <div className="glass rounded-[2rem] p-5 sm:p-8 w-full max-w-xl max-h-[calc(100vh-2rem)] overflow-y-auto animate-fade-in-up relative bg-[#0a0a0f] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-[60px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3 relative z-10">
              <span className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(124,58,237,0.3)]">✨</span>
              Thêm thẻ mới
            </h3>
            <form onSubmit={handleCreate} className="flex flex-col gap-6 relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-sm font-semibold text-cyan-200/80 uppercase tracking-wider">Mặt trước</label>
                    <button
                      type="button"
                      onClick={handleGenerateAI}
                      disabled={!AI_ENABLED || isGenerating}
                      className="text-xs flex items-center gap-1.5 bg-violet-600/30 hover:bg-violet-600/50 text-violet-200 px-3 py-1.5 rounded-lg transition-colors font-medium border border-violet-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={AI_ENABLED ? 'Nhập chủ đề hoặc từ vựng rồi nhấn để tạo bằng AI' : 'Sắp ra mắt'}
                    >
                      {isGenerating ? (
                        <>
                          <div className="w-3 h-3 border-2 border-violet-200/50 border-t-violet-200 rounded-full animate-spin" />
                          Đang tạo...
                        </>
                      ) : (
                        <>
                          <span>✨</span> AI Generate
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    value={front} onChange={e => setFront(e.target.value)} placeholder="Nhập từ hoặc chủ đề..."
                    className="bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-cyan-300 font-bold placeholder-cyan-800/40 text-base focus:bg-white/[0.05] focus:border-cyan-500/50 transition-all outline-none" autoFocus
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-pink-200/80 ml-1 uppercase tracking-wider">Mặt sau</label>
                  <input
                    value={back} onChange={e => setBack(e.target.value)} placeholder="Ví dụ: bắt kịp..."
                    className="bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-pink-300 font-bold placeholder-pink-800/40 text-base focus:bg-white/[0.05] focus:border-pink-500/50 transition-all outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-gray-400 ml-1 uppercase tracking-wider">Câu ví dụ (tùy chọn)</label>
                <textarea
                  value={example} onChange={e => setExample(e.target.value)} placeholder="Ví dụ: Let's catch up over coffee sometime." rows={3}
                  className="bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-cyan-100 placeholder-gray-600 text-base resize-none focus:bg-white/[0.05] focus:border-cyan-500/50 transition-all outline-none shadow-inner"
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 mt-2 justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 rounded-2xl text-base font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all">Hủy</button>
                <button type="submit" className="btn-primary px-8 py-3 rounded-2xl text-base font-bold shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:scale-[1.03] active:scale-95 transition-all">Lưu thẻ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Card list */}
      <div className="grid grid-cols-1 gap-5 pb-12">
        {cards.map((card, i) => {
          const isEditing = editingId === card.id
          return (
            <div
              key={card.id}
              onDoubleClick={() => !isEditing && handleStartEdit(card)}
              title={isEditing ? undefined : 'Nhấn đúp để chỉnh sửa'}
              className="group relative rounded-[1.25rem] animate-fade-in-up flex flex-col h-full cursor-pointer"
              style={{ animationDelay: `${(i % 10) * 40}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/0 to-cyan-500/0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-[1.25rem]" />
              <div className={`relative h-full flex-1 glass rounded-[1.25rem] p-5 sm:p-6 flex flex-col gap-4 border transition-all duration-300 overflow-hidden ${isEditing
                  ? 'border-violet-500/60 bg-white/[0.04] shadow-[0_8px_30px_rgba(124,58,237,0.2)]'
                  : 'border-white/10 group-hover:border-violet-500/50 group-hover:bg-white/[0.08] hover:shadow-[0_8px_30px_rgba(124,58,237,0.15)] hover:-translate-y-1'
                }`}>
                <div className="absolute -inset-2 bg-gradient-to-br from-violet-500/10 to-cyan-500/10 blur-xl opacity-0 group-hover:opacity-100 transition duration-500 -z-10" />

                {/* Header row: số thứ tự + từ vựng (view) hoặc badge + nút (edit) */}
                <div className="flex items-center justify-between gap-3 z-10 w-full">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 flex items-center justify-center text-sm text-gray-300 font-bold shrink-0 shadow-inner group-hover:bg-violet-500/20 group-hover:text-violet-200 group-hover:border-violet-500/40 transition-all duration-300">
                      {i + 1}
                    </div>
                    {!isEditing && (
                      <div className="min-w-0">
                        <p className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400 text-2xl tracking-tight drop-shadow-sm group-hover:scale-105 origin-left group-hover:from-cyan-300 group-hover:to-violet-300 transition-all truncate pb-1">
                          {card.front_text}
                        </p>
                        {card.source_type === 'anki_library' && <span title={card.source_name ? `Nguồn: ${card.source_name}` : 'Dữ liệu từ thư viện Anki'} className="mt-1 inline-flex rounded-md border border-cyan-300/25 bg-cyan-400/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-cyan-200">Thư viện Anki</span>}
                      </div>
                    )}
                  </div>

                  {/* Nút xóa (view) hoặc Lưu/Hủy (edit) */}
                  {isEditing ? (
                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                      <button type="button" onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                        Hủy
                      </button>
                      <button type="button" onClick={e => { e.stopPropagation(); handleUpdate() }}
                        className="btn-primary px-4 py-1.5 rounded-xl text-xs font-bold shadow-lg shadow-violet-500/30 hover:scale-[1.02] transition-transform">
                        Lưu
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(card.id); }}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 bg-white/5 hover:text-white hover:bg-red-500 border border-transparent hover:border-red-400/50 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] transition-all"
                        title="Xóa thẻ">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Nội dung: view hoặc edit inline */}
                <div className="flex flex-col flex-1 gap-3 z-10 w-full">
                  {isEditing ? (
                    <>
                      {/* Front input - full width */}
                      <input
                        value={editFront}
                        onChange={e => setEditFront(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        placeholder="Từ vựng..."
                        className="w-full bg-white/5 border border-cyan-500/40 focus:border-cyan-400 outline-none rounded-xl px-4 py-2 text-cyan-300 font-extrabold text-xl tracking-tight transition-colors"
                        autoFocus
                      />
                      {/* Back input - full width */}
                      <input
                        value={editBack}
                        onChange={e => setEditBack(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        placeholder="Định nghĩa..."
                        className="w-full bg-white/5 border border-pink-500/40 focus:border-pink-400 outline-none rounded-xl px-4 py-2 text-pink-300 font-bold text-[17px] transition-colors"
                      />
                      {/* Example textarea - full width */}
                      <textarea
                        value={editExample}
                        onChange={e => setEditExample(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        placeholder="Câu ví dụ..."
                        rows={2}
                        className="w-full bg-cyan-950/30 border border-cyan-500/30 focus:border-cyan-400 outline-none text-cyan-100/90 text-[15px] italic leading-relaxed px-4 py-3 rounded-xl resize-none transition-colors"
                      />
                    </>
                  ) : (
                    <>
                      <p className="text-pink-300 text-[17px] leading-relaxed font-bold drop-shadow-md break-words">{card.back_text}</p>
                      {card.example_sentence && (
                        <div className="mt-auto pt-1 w-full">
                          <p className="text-cyan-100/90 text-[15px] italic leading-relaxed bg-cyan-950/30 px-4 py-3 rounded-xl border border-cyan-500/20 w-full break-words shadow-inner block">
                            "{card.example_sentence}"
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {cards.length < total && (
          <div className="flex justify-center pt-3">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-6 py-3 font-bold text-violet-200 transition-colors hover:bg-violet-500/20 disabled:cursor-wait disabled:opacity-60"
            >
              {loadingMore ? 'Đang tải...' : `Tải thêm (${cards.length}/${total})`}
            </button>
          </div>
        )}

        {total === 0 && !showForm && (
          <div className="col-span-full text-center py-24 animate-fade-in relative">
            <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
              <div className="w-64 h-64 bg-violet-500/10 rounded-full blur-[80px]" />
            </div>
            <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-tr from-violet-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-5xl mx-auto mb-6 shadow-[0_0_30px_rgba(124,58,237,0.15)] relative backdrop-blur-sm z-10 animate-[bounce_3s_ease-in-out_infinite]">
              ✨
            </div>
            <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-2 relative z-10">Chưa có thẻ nào</h3>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto leading-relaxed relative z-10">Bộ thẻ này đang trống. Hãy thêm những từ vựng đầu tiên để bắt đầu hành trình học tập của bạn!</p>
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2 shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:scale-105 transition-transform relative z-10"
            >
              <span className="text-lg leading-none mb-0.5">+</span> Thêm thẻ ngay
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
