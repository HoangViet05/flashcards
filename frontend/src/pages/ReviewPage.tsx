import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDueCards, submitReview } from '../api/review'
import { getCards } from '../api/cards'
import { getDecks } from '../api/decks'
import FlipCard from '../components/FlipCard'
import type { Review, Card, StudyVariant } from '../types'

type ReviewQueueItem = {
  review: Review | null
  card: Card
  variant: StudyVariant
}

const CARD_TYPE_PARAM_TO_VARIANT: Record<string, StudyVariant> = {
  standard: 'standard',
  basic: 'standard',
  cloze: 'cloze',
  reverse: 'reverse',
  reversed: 'reverse',
}

function getStudyVariant() {
  const params = new URLSearchParams(window.location.search)
  const typeParam = params.get('type')?.toLowerCase() || 'standard'
  return CARD_TYPE_PARAM_TO_VARIANT[typeParam] || 'standard'
}

function cardSupportsVariant(card: Card, variant: StudyVariant) {
  if (variant === 'cloze') {
    const sentence = card.example_sentence?.trim()
    const target = card.front_text.trim()
    return Boolean(sentence && target && sentence.toLowerCase().includes(target.toLowerCase()))
  }

  if (variant === 'reverse') {
    return Boolean(card.back_text.trim() || card.image_url)
  }

  return true
}

const DAY_MS = 24 * 60 * 60 * 1000

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatInterval(days: number) {
  if (days === 0) return 'today'
  if (days === 1) return '1 day'
  return `${days} days`
}

function formatDueDate(value: string) {
  return parseDateOnly(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getDueExplanation(review: Review) {
  const today = new Date()
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const dueDate = parseDateOnly(review.due_date)
  const dayDiff = Math.round((todayOnly.getTime() - dueDate.getTime()) / DAY_MS)

  if (review.repetitions === 0) {
    return `This is a new card. It is due now because it has not been reviewed yet.`
  }

  if (dayDiff === 0) {
    return `This card is scheduled for today after its ${formatInterval(review.interval)} SM-2 interval.`
  }

  if (dayDiff > 0) {
    return `This card was scheduled ${formatInterval(dayDiff)} ago after its ${formatInterval(review.interval)} SM-2 interval.`
  }

  return `This card is in the queue because its scheduled due date is ${formatDueDate(review.due_date)}.`
}

function SrsDetailsPanel({ review }: { review: Review }) {
  const stats = [
    { label: 'Repetitions', value: review.repetitions },
    { label: 'Easiness', value: review.ease_factor.toFixed(2) },
    { label: 'Next interval', value: formatInterval(review.interval) },
    { label: 'Due date', value: formatDueDate(review.due_date) },
  ]

  return (
    <aside className="rounded-2xl border border-white/10 bg-black/25 backdrop-blur-md overflow-hidden shadow-[0_18px_45px_rgba(0,0,0,0.22)] lg:sticky lg:top-28">
      <div className="px-4 sm:px-5 py-3 border-b border-white/10">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-200">
          <span className="w-2 h-2 rounded-full bg-cyan-300/80 shadow-[0_0_12px_rgba(103,232,249,0.5)]" />
          SRS details
        </h2>
      </div>

      <div className="px-4 sm:px-5 py-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          {stats.map(stat => (
            <div key={stat.label} className="rounded-xl bg-white/[0.04] border border-white/8 px-3 py-3">
              <p className="text-[0.68rem] uppercase tracking-widest text-gray-500 font-bold mb-1">{stat.label}</p>
              <p className="text-base sm:text-lg font-extrabold text-white break-words">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-cyan-500/15 bg-cyan-500/[0.04] px-3 py-3">
          <p className="text-[0.68rem] uppercase tracking-widest text-cyan-300/80 font-bold mb-2">Why now</p>
          <p className="text-sm leading-relaxed text-gray-400">
            {getDueExplanation(review)}
          </p>
        </div>
      </div>
    </aside>
  )
}

export default function ReviewPage() {
  const [queue, setQueue] = useState<ReviewQueueItem[]>([])
  const [current, setCurrent] = useState(0)
  const [done, setDone] = useState(0)
  const [loading, setLoading] = useState(true)

  const [animatingDir, setAnimatingDir] = useState<'next' | 'prev' | null>(null)
  const [actionDir, setActionDir] = useState<'next' | 'prev'>('next')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const deckIdFilter = params.get('deckId')
    const modeFilter = params.get('mode') // 'learn', 'review', or 'practice'
    const studyVariant = getStudyVariant()

    const load = async () => {
      const [dueReviews, decks] = await Promise.all([getDueCards(), getDecks()])
      const allCards: Card[] = []
      
      const decksToLoad = deckIdFilter ? decks.filter(d => d.id === deckIdFilter) : decks
      
      for (const deck of decksToLoad) {
        const cards = await getCards(deck.id)
        allCards.push(...cards)
      }
      
      const cardMap = Object.fromEntries(allCards.map(c => [c.id, c]))
      let items: ReviewQueueItem[] = dueReviews
        .map(r => ({ review: r, card: cardMap[r.card_id], variant: studyVariant }))
        .filter(item => item.card != null)

      if (modeFilter === 'learn') {
        items = items.filter(item => item.review && item.review.repetitions === 0)
      } else if (modeFilter === 'review') {
        items = items.filter(item => item.review && item.review.repetitions > 0)
      } else if (modeFilter === 'practice') {
        items = allCards.map(c => ({ review: null, card: c, variant: studyVariant }))
      }

      items = items.filter(item => cardSupportsVariant(item.card, item.variant))
      
      setQueue(items)
      setLoading(false)
    }
    load()
  }, [])

  const handleNext = () => {
    setAnimatingDir('next')
    setActionDir('next')
    setTimeout(() => {
      setDone(d => d + 1)
      setCurrent(c => c + 1)
      setAnimatingDir(null)
    }, 250)
  }

  const handlePrev = () => {
    setAnimatingDir('prev')
    setActionDir('prev')
    setTimeout(() => {
      setDone(d => Math.max(0, d - 1))
      setCurrent(c => Math.max(0, c - 1))
      setAnimatingDir(null)
    }, 250)
  }

  const handleRate = async (quality: number) => {
    const item = queue[current]
    if (item.review) {
      submitReview(item.card.id, quality).catch(err => console.error(err))
    }
    handleNext()
  }

  const isPractice = new URLSearchParams(window.location.search).get('mode') === 'practice'

  useEffect(() => {
    if (!isPractice || current >= queue.length) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable

      if (isTyping || animatingDir) return

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        handleNext()
      } else if (event.key === 'ArrowLeft' && current > 0) {
        event.preventDefault()
        handlePrev()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPractice, current, queue.length, animatingDir])

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
      <p className="text-gray-400 mb-10 text-lg leading-relaxed max-w-sm">Bạn đã hoàn thành tất cả thẻ trong phiên này. Nghỉ ngơi và trở lại học ngày mai nhé!</p>
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
        Bạn đã {isPractice ? 'lướt qua' : 'ghi nhớ được'} <span className="text-violet-400 font-bold bg-violet-500/10 px-2 py-0.5 rounded-md border border-violet-500/20">{done} thẻ</span> trong phiên.
      </p>
      <Link to="/" className="btn-primary px-8 py-3.5 rounded-xl font-bold inline-flex items-center gap-2 shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:scale-105 transition-transform">
        Quay lại trang chủ
      </Link>
    </div>
  )

  const item = queue[current]
  const progress = Math.round((current / queue.length) * 100)

  const animClass = animatingDir === 'next' ? 'animate-slide-out-next' 
                  : animatingDir === 'prev' ? 'animate-slide-out-prev' 
                  : actionDir === 'next'    ? 'animate-slide-in-next'
                  :                           'animate-slide-in-prev';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12 relative isolate overflow-hidden">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 -z-10" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none translate-y-1/2 -z-10" />
      
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,48rem)_minmax(18rem,22rem)] lg:justify-center lg:gap-8">
        <div className="w-full max-w-3xl min-w-0 mx-auto lg:max-w-none">
      <div className="mb-6 sm:mb-10 animate-fade-in-up">
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
      
      <div key={current} className={`relative z-10 w-full min-w-0 overflow-hidden ${animClass}`}>
        <FlipCard 
          card={item.card} 
          variant={item.variant}
          onRate={handleRate} 
          onNext={handleNext}
          onPrev={current > 0 ? handlePrev : undefined}
          isPractice={isPractice} 
        />
      </div>
        </div>

        {item.review && (
          <div key={`${current}-srs`} className="relative z-10 w-full max-w-3xl mx-auto lg:max-w-none lg:pt-[5.35rem]">
            <SrsDetailsPanel review={item.review} />
          </div>
        )}
      </div>
    </div>
  )
}
