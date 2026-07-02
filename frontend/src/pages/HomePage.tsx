import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDecks, createDeck, deleteDeck } from '../api/decks'
import { getDueCards } from '../api/review'
import { getCards, createCard } from '../api/cards'
import { generateAIBatchStream } from '../api/ai'
import { useNotification } from '../components/NotificationProvider'
import DeckCard from '../components/DeckCard'
import RobotAnimation from '../components/RobotAnimation'
import type { Deck, Review } from '../types'

type RobotAction = 'thinking' | 'add' | 'throw'

interface GlobalFlyingCardData {
  id: string;
  word: string;
  targetDeckId: string;
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
    // Add randomness so they stack beautifully when multiple generate quickly
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
        const target = document.querySelector(`a[href="/decks/${data.targetDeckId}"]`);
        if (target) {
          const rect = target.getBoundingClientRect();
          const targetX = rect.left + 50;
          const targetY = rect.top + 60;

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
    }, 1200); // Wait in center for 1.2s to show off the card

    const t3 = setTimeout(() => {
      onComplete();
    }, 1900);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); }
  }, [data.targetDeckId, isRejected, onComplete]);

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

export default function HomePage() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [dueReviews, setDueReviews] = useState<Review[]>([])
  const [cardCounts, setCardCounts] = useState<Record<string, number>>({})
  const [dueCounts, setDueCounts] = useState<Record<string, number>>({})
  const [newCounts, setNewCounts] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [showForm, setShowForm] = useState(false)

  const [aiTopic, setAiTopic] = useState('')
  const [aiCount, setAiCount] = useState(5)
  const [isGenerating, setIsGenerating] = useState(false)
  const [globalFlyingCards, setGlobalFlyingCards] = useState<GlobalFlyingCardData[]>([])
  const [robotAction, setRobotAction] = useState<RobotAction>('thinking')
  const actionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { toast, confirm } = useNotification()

  const load = async () => {
    const [d, r] = await Promise.all([getDecks(), getDueCards()])
    setDecks(d)
    setDueReviews(r)

    // Load card counts and due/new counts per deck
    const counts: Record<string, number> = {}
    const dueByDeck: Record<string, number> = {}
    const newByDeck: Record<string, number> = {}

    await Promise.all(d.map(async deck => {
      const cards = await getCards(deck.id)
      counts[deck.id] = cards.length

      const cardIds = new Set(cards.map(c => c.id))
      dueByDeck[deck.id] = r.filter(rev => cardIds.has(rev.card_id) && rev.repetitions > 0).length
      newByDeck[deck.id] = r.filter(rev => cardIds.has(rev.card_id) && rev.repetitions === 0).length
    }))

    setCardCounts(counts)
    setDueCounts(dueByDeck)
    setNewCounts(newByDeck)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await createDeck({ name: name.trim(), description: desc.trim() || undefined })
    toast(`Đã tạo bộ thẻ "${name.trim()}"`, 'success')
    setName(''); setDesc(''); setShowForm(false)
    load()
  }

  const handleGenerateAICard = async (e: React.FormEvent) => {
    e.preventDefault()
    const topic = aiTopic.trim()
    if (!topic) return

    setIsGenerating(true)
    setRobotAction('thinking')
    try {
      let targetDeckId = ''
      let excludedWords: string[] = []
      const existingDeck = decks.find(d => d.name.toLowerCase() === topic.toLowerCase())

      if (existingDeck) {
        targetDeckId = existingDeck.id
        // Lấy danh sách thẻ hiện có để exclude khỏi AI (chống gen trùng)
        const existingCards = await getCards(targetDeckId)
        excludedWords = existingCards.map(c => c.front_text)
      }

      if (!existingDeck) {
        const newDeck = await createDeck({ name: topic })
        targetDeckId = newDeck.id
        // Load immediately so the new deck appears on screen before cards are added
        await load()
      }

      let successCount = 0;

      // Giờ mới gọi AI stream và truyền excludedWords
      await generateAIBatchStream(topic, aiCount, excludedWords, async (card) => {
        try {
          const word = card.front_text || topic;
          const isDuplicate = excludedWords.some(w => w.toLowerCase() === word.toLowerCase());

          if (isDuplicate) {
            setGlobalFlyingCards(prev => [...prev, { id: Date.now() + '-' + Math.random(), word, targetDeckId, status: 'rejected' }]);
            if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current)
            setRobotAction('throw')
            actionTimeoutRef.current = setTimeout(() => setRobotAction('thinking'), 1000)
          } else {
            await createCard(targetDeckId, {
              front_text: word,
              back_text: card.back_text || '',
              example_sentence: card.example_sentence || undefined
            });
            successCount++;
            excludedWords.push(word);

            // Bắn thẻ bay ngay giữa màn hình
            setGlobalFlyingCards(prev => [...prev, { id: Date.now() + '-' + Math.random(), word, targetDeckId, status: 'success' }]);
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
        toast(`Đã tạo thành công ${successCount + 1} thẻ AI cho chủ đề "${topic}"`, 'success')
      } else {
        toast(`Không thể tạo thẻ nào, có thể chủ đề này đã có đầy đủ thẻ.`, 'info')
      }
      setAiTopic('')
      load()
    } catch (err: any) {
      console.error(err)
      toast("Không thể tạo từ AI. Vui lòng kiểm tra lại kết nối.", 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDelete = async (id: string) => {
    const deck = decks.find(d => d.id === id)
    confirm({
      title: 'Xác nhận xóa',
      message: `Bạn có chắc chắn muốn xóa bộ thẻ "${deck?.name}"? Hành động này không thể hoàn tác.`,
      confirmText: 'Xóa ngay',
      variant: 'danger',
      onConfirm: async () => {
        await deleteDeck(id)
        toast('Đã xóa bộ thẻ', 'success')
        load()
      }
    })
  }

  const totalCards = Object.values(cardCounts).reduce((a, b) => a + b, 0)
  const newReviews = dueReviews.filter(r => r.repetitions === 0)
  const dueOnly = dueReviews.filter(r => r.repetitions > 0)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">

      {/* Global Flying Cards Layer */}
      {globalFlyingCards.map(fc => (
        <FlyingGlassCard
          key={fc.id}
          data={fc}
          onComplete={() => setGlobalFlyingCards(prev => prev.filter(c => c.id !== fc.id))}
        />
      ))}

      {/* AI Generation Animation */}
      <RobotAnimation isVisible={isGenerating} action={robotAction} />
      {/* Hero banner when there are due cards */}
      {dueReviews.length > 0 && (
        <div className="mb-10 relative rounded-[2rem] p-[1px] animate-fade-in-up" style={{ boxShadow: '0 20px 40px -15px rgba(124,58,237,0.25)' }}>
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600/50 via-purple-500/40 to-cyan-500/50 opacity-80 blur-md pointer-events-none rounded-[2rem]" />
          <div className="relative glass rounded-[2rem] p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 overflow-hidden bg-black/40 backdrop-blur-xl border border-white/10">
            {/* Decorative glare */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-2xl pointer-events-none opacity-60" />

            <div className="flex items-center gap-5 relative z-10 w-full sm:w-auto">
              <div className="w-16 h-16 rounded-[1.25rem] bg-gradient-to-br from-violet-500/20 to-purple-600/30 border border-violet-500/40 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(139,92,246,0.3)] shrink-0 animate-pulse-glow">
                🔥
              </div>
              <div>
                <p className="text-white font-extrabold text-xl sm:text-2xl tracking-tight">
                  {dueOnly.length > 0 ? (
                    <><span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">{dueOnly.length}</span> thẻ đang chờ ôn!</>
                  ) : (
                    <><span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">{newReviews.length}</span> từ mới đang chờ bạn!</>
                  )}
                </p>
                <p className="text-gray-400 text-sm sm:text-base mt-1 font-medium">
                  {dueOnly.length > 0 && newReviews.length > 0
                    ? `Cùng ${newReviews.length} từ mới sẵn sàng để học.`
                    : 'Giữ vững chuỗi streak, học ngay nào.'}
                </p>
              </div>
            </div>

            <Link
              to={dueOnly.length > 0 ? '/review?mode=review' : '/review?mode=learn'}
              className="w-full sm:w-auto flex items-center justify-center gap-2 btn-primary px-8 py-3.5 rounded-xl font-bold shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:shadow-[0_0_30px_rgba(124,58,237,0.6)] hover:scale-105 transition-all text-base relative z-10"
            >
              Bắt đầu ôn 🚀
            </Link>
          </div>
        </div>
      )}

      {/* Stats row */}
      {decks.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          {[
            { label: 'Bộ thẻ', value: decks.length, icon: '🗂️', color: 'from-blue-500/20 to-cyan-500/10', border: 'border-blue-500/30', text: 'text-blue-300' },
            { label: 'Tổng thẻ', value: totalCards, icon: '🃏', color: 'from-violet-500/20 to-purple-500/10', border: 'border-violet-500/30', text: 'text-violet-300' },
            { label: 'Từ mới', value: newReviews.length, icon: '✨', color: 'from-amber-500/20 to-yellow-500/10', border: 'border-amber-500/30', text: 'text-amber-300' },
            { label: 'Cần ôn hôm nay', value: dueOnly.length, icon: '⏰', color: 'from-orange-500/20 to-red-500/10', border: 'border-orange-500/30', text: 'text-orange-300' },
          ].map((s, i) => (
            <div key={s.label} className={`glass rounded-[1.5rem] p-5 flex items-center gap-4 bg-gradient-to-br ${s.color} border ${s.border} hover:scale-[1.02] transition-transform duration-300`}>
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl shadow-inner border border-white/10 shrink-0">
                {s.icon}
              </div>
              <div>
                <p className={`text-2xl font-black ${s.text} tracking-tight`}>{s.value}</p>
                <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight">Bộ thẻ của bạn</h1>
          {decks.length > 0 && <p className="text-gray-500 text-sm mt-1.5 font-medium">{decks.length} bộ thẻ đang theo dõi</p>}
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          className="btn-primary px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(124,58,237,0.3)] hover:scale-[1.02] transition-transform"
        >
          <span className="text-lg leading-none mb-0.5">+</span> Tạo bộ thẻ
        </button>
      </div>

      {/* AI Generator Box */}
      <div className="mb-10 relative rounded-[2rem] p-[1px] animate-fade-in-up" style={{ animationDelay: '90ms' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/50 via-blue-500/30 to-violet-500/40 opacity-70 blur-md pointer-events-none" />
        <div className="relative glass rounded-[2rem] p-6 sm:p-7 overflow-hidden bg-[#0f172a]/60 backdrop-blur-xl border border-white/10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-[60px] pointer-events-none -translate-y-1/2 translate-x-1/2" />

          <div className="flex flex-col gap-4 relative z-10">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(6,182,212,0.3)]">✨</span>
              <h2 className="text-xl font-bold text-white tracking-tight">Trợ lý AI tạo thẻ nhanh</h2>
            </div>
            <p className="text-gray-400 text-sm">Nhập chủ đề bạn muốn học (VD: Đàm phán, ReactJS) và chọn số lượng. AI sẽ tạo hàng loạt thẻ mới và thêm vào bộ thẻ tương ứng ⚡.</p>

            <form onSubmit={handleGenerateAICard} className="flex flex-col sm:flex-row gap-3 mt-1">
              <input
                value={aiTopic}
                onChange={e => setAiTopic(e.target.value)}
                placeholder="Nhập bất kỳ chủ đề hoặc từ vựng..."
                className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-5 py-3.5 text-cyan-100 font-medium placeholder-gray-500 focus:bg-white/[0.05] focus:border-cyan-500/50 transition-all outline-none"
                disabled={isGenerating}
              />
              <div className="flex items-center bg-white/[0.03] border border-white/10 rounded-xl p-1.5 transition-all hover:bg-white/[0.04] focus-within:bg-white/[0.05] focus-within:border-cyan-500/50 shrink-0">
                <span className="text-gray-500 text-sm font-medium ml-3 mr-2 whitespace-nowrap hidden sm:inline">Số thẻ:</span>
                <span className="text-gray-500 text-sm font-medium ml-2 mr-2 whitespace-nowrap sm:hidden">#</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAiCount(prev => Math.max(1, prev - 1))}
                    disabled={isGenerating || aiCount <= 1}
                    className="w-9 h-9 rounded-[0.6rem] bg-white/[0.05] hover:bg-white/10 active:scale-95 flex items-center justify-center text-cyan-400 font-bold disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all shadow-inner"
                  >
                    –
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={aiCount}
                    onChange={e => setAiCount(parseInt(e.target.value) || 5)}
                    className="w-10 bg-transparent text-cyan-100 font-bold text-lg text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    disabled={isGenerating}
                  />
                  <button
                    type="button"
                    onClick={() => setAiCount(prev => Math.min(50, prev + 1))}
                    disabled={isGenerating || aiCount >= 50}
                    className="w-9 h-9 rounded-[0.6rem] bg-white/[0.05] hover:bg-white/10 active:scale-95 flex items-center justify-center text-cyan-400 font-bold disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all shadow-inner"
                  >
                    +
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={isGenerating || !aiTopic.trim()}
                className="btn-primary bg-cyan-600 hover:bg-cyan-500 px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 sm:w-auto text-sm"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    Đang tạo...
                  </>
                ) : (
                  <>Tạo thẻ 🪄</>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowForm(false)} />
          <div className="glass rounded-[2rem] p-8 w-full max-w-xl animate-fade-in-up relative overflow-hidden bg-[#0a0a0f] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-[60px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3 relative z-10">
              <span className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(124,58,237,0.3)]">✨</span>
              Tạo bộ thẻ mới
            </h3>
            <form onSubmit={handleCreate} className="flex flex-col gap-6 relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-gray-400 ml-1 uppercase tracking-wider">Tên bộ thẻ</label>
                  <input
                    value={name} onChange={e => setName(e.target.value)} placeholder="Ví dụ: Tiếng Anh giao tiếp..."
                    className="bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white font-bold placeholder-gray-600 text-base focus:bg-white/[0.05] focus:border-violet-500/50 transition-all outline-none" autoFocus
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-gray-400 ml-1 uppercase tracking-wider">Mô tả (tùy chọn)</label>
                  <input
                    value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ví dụ: Dùng cho..."
                    className="bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white font-bold placeholder-gray-600 text-base focus:bg-white/[0.05] focus:border-violet-500/50 transition-all outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-2 justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 rounded-2xl text-base font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all">Hủy</button>
                <button type="submit" className="btn-primary px-8 py-3 rounded-2xl text-base font-bold shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:scale-[1.03] active:scale-95 transition-all">Lưu bộ thẻ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deck grid */}
      {decks.length === 0 ? (
        <div className="text-center py-20 animate-fade-in relative">
          <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
            <div className="w-64 h-64 bg-violet-500/10 rounded-full blur-[80px]" />
          </div>
          <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-tr from-violet-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-5xl mx-auto mb-6 shadow-[0_0_30px_rgba(124,58,237,0.15)] relative backdrop-blur-sm z-10 animate-[bounce_3s_ease-in-out_infinite]">
            📭
          </div>
          <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-2 relative z-10">Chưa có bộ thẻ nào</h3>
          <p className="text-gray-500 mb-8 max-w-sm mx-auto leading-relaxed relative z-10">Tạo bộ thẻ đầu tiên để bắt đầu lưu trữ và ôn tập kiến thức!</p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2 shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:scale-105 transition-transform relative z-10"
          >
            <span className="text-lg leading-none mb-0.5">+</span> Tạo bộ thẻ ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map((deck, i) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              dueCount={dueCounts[deck.id] ?? 0}
              newCount={newCounts[deck.id] ?? 0}
              cardCount={cardCounts[deck.id] ?? 0}
              onDelete={handleDelete}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  )
}
