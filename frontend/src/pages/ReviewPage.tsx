import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDueCards, submitReview } from '../api/review'
import { getCards } from '../api/cards'
import { getDecks } from '../api/decks'
import FlipCard from '../components/FlipCard'
import type { Review, Card } from '../types'

export default function ReviewPage() {
  const [queue, setQueue] = useState<Array<{ review: Review; card: Card }>>([])
  const [current, setCurrent] = useState(0)
  const [done, setDone] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const deckIdFilter = params.get('deckId')
    const modeFilter = params.get('mode') // 'learn' hoặc 'review'

    const load = async () => {
      const [dueReviews, decks] = await Promise.all([getDueCards(), getDecks()])
      const allCards: Card[] = []
      
      // Nếu có filter deckId, ta chỉ cần lấy cards của deck đó cho nhanh
      const decksToLoad = deckIdFilter ? decks.filter(d => d.id === deckIdFilter) : decks
      
      for (const deck of decksToLoad) {
        const cards = await getCards(deck.id)
        allCards.push(...cards)
      }
      
      const cardMap = Object.fromEntries(allCards.map(c => [c.id, c]))
      let items = dueReviews
        .map(r => ({ review: r, card: cardMap[r.card_id] }))
        .filter(item => item.card != null)

      // Áp dụng bộ lọc mode
      if (modeFilter === 'learn') {
        items = items.filter(item => item.review.repetitions === 0)
      } else if (modeFilter === 'review') {
        items = items.filter(item => item.review.repetitions > 0)
      }
      
      setQueue(items)
      setLoading(false)
    }
    load()
  }, [])

  const handleRate = async (quality: number) => {
    const item = queue[current]
    await submitReview(item.card.id, quality)
    setDone(d => d + 1)
    setCurrent(c => c + 1)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-gray-600">
        <div className="w-5 h-5 border-2 border-violet-500/50 border-t-violet-500 rounded-full animate-spin" />
        Đang tải...
      </div>
    </div>
  )

  if (queue.length === 0) return (
    <div className="max-w-md mx-auto px-6 py-24 text-center animate-fade-in relative z-10 flex flex-col items-center">
      <div className="absolute inset-0 flex justify-center items-center pointer-events-none -z-10">
        <div className="w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]" />
      </div>
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[2rem] bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-5xl sm:text-6xl mb-8 shadow-[0_0_30px_rgba(16,185,129,0.2)] backdrop-blur-sm animate-[bounce_3s_ease-in-out_infinite]">
        🎉
      </div>
      <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-200 mb-3 drop-shadow-sm">Tuyệt vời!</h2>
      <p className="text-gray-400 mb-10 text-lg leading-relaxed max-w-sm">Bạn đã hoàn thành tất cả thẻ cần ôn. Nghỉ ngơi và trở lại học ngày mai nhé!</p>
      <Link to="/" className="btn-primary px-8 py-3.5 rounded-xl font-bold inline-flex items-center gap-2 shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:scale-105 transition-transform">
        Quay lại trang chủ
      </Link>
    </div>
  )

  if (current >= queue.length) return (
    <div className="max-w-md mx-auto px-6 py-24 text-center animate-fade-in relative z-10 flex flex-col items-center">
      <div className="absolute inset-0 flex justify-center items-center pointer-events-none -z-10">
        <div className="w-64 h-64 bg-violet-500/10 rounded-full blur-[80px]" />
      </div>
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[2rem] bg-gradient-to-tr from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center text-5xl sm:text-6xl mb-8 shadow-[0_0_30px_rgba(139,92,246,0.2)] backdrop-blur-sm animate-[bounce_3s_ease-in-out_infinite]">
        🧠
      </div>
      <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-cyan-300 mb-3 drop-shadow-sm">Hoàn thành phiên ôn!</h2>
      <p className="text-gray-400 mb-10 text-lg leading-relaxed max-w-sm">
        Bạn đã ghi nhớ được <span className="text-violet-400 font-bold bg-violet-500/10 px-2 py-0.5 rounded-md border border-violet-500/20">{done} thẻ</span> trong phiên.
      </p>
      <Link to="/" className="btn-primary px-8 py-3.5 rounded-xl font-bold inline-flex items-center gap-2 shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:scale-105 transition-transform">
        Quay lại trang chủ
      </Link>
    </div>
  )

  const item = queue[current]
  const progress = Math.round((current / queue.length) * 100)

  return (
    <div className="max-w-xl mx-auto px-6 py-12 relative">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 -z-10" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none translate-y-1/2 -z-10" />
      
      <div className="mb-10 animate-fade-in-up">
        <div className="flex justify-between items-center mb-4 px-2">
          <div className="glass px-4 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-md">
            <span className="text-white font-bold text-sm bg-white/10 w-6 h-6 rounded-full flex items-center justify-center">{current + 1}</span>
            <span className="text-gray-400 text-sm font-medium">/ {queue.length}</span>
          </div>
          <span className="text-emerald-400 text-sm font-bold bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(16,185,129,0.15)] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {done} hoàn thành
          </span>
        </div>
        <div className="h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/5 backdrop-blur-sm shadow-inner">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out relative"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #8b5cf6, #06b6d4, #3b82f6)' }}
          >
            <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-white/30 to-transparent" />
          </div>
        </div>
      </div>
      
      <div className="relative z-10 w-full animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <FlipCard key={current} card={item.card} onRate={handleRate} />
      </div>
    </div>
  )
}
