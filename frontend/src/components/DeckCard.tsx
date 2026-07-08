import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import type { Deck } from '../types'

interface Props {
  deck: Deck
  dueCount?: number
  newCount?: number
  cardCount?: number
  onDelete: (id: string) => void
  index?: number
}

const DECK_GRADIENTS = [
  'from-violet-600/20 to-purple-800/10',
  'from-cyan-600/20 to-blue-800/10',
  'from-pink-600/20 to-rose-800/10',
  'from-amber-600/20 to-orange-800/10',
  'from-emerald-600/20 to-teal-800/10',
  'from-indigo-600/20 to-violet-800/10',
]

const DECK_ACCENTS = [
  'border-violet-500/30 hover:border-violet-400/60',
  'border-cyan-500/30 hover:border-cyan-400/60',
  'border-pink-500/30 hover:border-pink-400/60',
  'border-amber-500/30 hover:border-amber-400/60',
  'border-emerald-500/30 hover:border-emerald-400/60',
  'border-indigo-500/30 hover:border-indigo-400/60',
]

const DECK_BADGE = [
  'bg-violet-500/20 text-violet-300 border-violet-500/30',
  'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'bg-pink-500/20 text-pink-300 border-pink-500/30',
  'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
]

export default function DeckCard({ deck, dueCount = 0, newCount = 0, cardCount = 0, onDelete, index = 0 }: Props) {
  const i = index % DECK_GRADIENTS.length
  
  const [flyingCards, setFlyingCards] = useState<{id: number}[]>([])
  const prevCardCount = useRef(cardCount)

  useEffect(() => {
    // Chỉ tạo thẻ bay vào khi số lượng thẻ tăng lên (được thêm mới)
    if (cardCount > prevCardCount.current && prevCardCount.current !== 0) {
        const id = Date.now() + Math.random()
        setFlyingCards(prev => [...prev, { id }])
        // Xóa khỏi DOM sau khi animation hoàn tất
        setTimeout(() => {
            setFlyingCards(prev => prev.filter(c => c.id !== id))
        }, 800)
    }
    prevCardCount.current = cardCount
  }, [cardCount])

  return (
      <div
        className={`group relative rounded-[2rem] p-[1px] cursor-pointer animate-fade-in-up transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(124,58,237,0.3)]`}
        style={{ animationDelay: `${index * 60}ms` }}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${DECK_GRADIENTS[i]} opacity-80 rounded-[2rem] pointer-events-none group-hover:opacity-100 transition-opacity duration-300`} />
        <div className={`relative h-full flex flex-col gap-4 bg-black/40 backdrop-blur-xl rounded-[2rem] p-5 sm:p-6 border ${DECK_ACCENTS[i]} transition-colors duration-300 overflow-hidden`}>
          
          {/* Subtle background glow effect */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-[40px] pointer-events-none -translate-y-1/2 translate-x-1/2 group-hover:bg-white/10 transition-colors" />

          {/* Delete button */}
          <button
            onClick={e => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                onDelete(deck.id); 
            }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-500/80 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all shrink-0 z-20 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 border border-white/5 hover:border-transparent bg-white/5 backdrop-blur-md"
            title="Xóa bộ thẻ"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
    
          <Link to={`/decks/${deck.id}`} className="flex-1 flex flex-col gap-4 relative z-10">
            {/* Icon + name */}
            <div className="flex items-start gap-4 pr-6">
              <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 border ${DECK_BADGE[i]} shadow-inner group-hover:scale-110 transition-transform duration-300`}>
                📚
                {flyingCards.map(fc => (
                  <div key={fc.id} className="absolute inset-0 m-auto w-7 h-9 bg-gradient-to-br from-white to-gray-200 rounded shadow-xl text-violet-600 font-extrabold flex items-center justify-center border border-white z-50 animate-fly-into-deck pointer-events-none">
                    <span className="text-[10px] tracking-tighter leading-none pr-[1px] pt-[1px]">+1</span>
                  </div>
                ))}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h3 className="font-bold text-white text-lg leading-tight line-clamp-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-300 transition-all">{deck.name}</h3>
              </div>
            </div>

        {deck.description && (
          <p className="text-gray-500 text-xs line-clamp-2 leading-relaxed">{deck.description}</p>
        )}

            {/* Stats row */}
            <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between gap-2 mt-auto pt-4 border-t border-white/5 group-hover:border-white/10 transition-colors duration-300">
              <span className="text-gray-400 text-sm font-medium bg-white/[0.03] px-3 py-1 rounded-full border border-white/5">{cardCount} thẻ</span>
              
              {cardCount === 0 ? (
                <span className="text-xs text-violet-400 bg-violet-500/10 px-3 py-1 rounded-full border border-violet-500/20 font-medium flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />
                  Chưa có thẻ
                </span>
              ) : dueCount > 0 ? (
                <span className={`text-xs px-3 py-1 rounded-full border font-bold shadow-lg ${DECK_BADGE[i]}`}>
                  <span className="mr-1">🔥</span> {dueCount} cần ôn
                </span>
              ) : newCount > 0 ? (
                <span className="text-xs text-amber-300 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30 font-bold shadow-lg">
                  <span className="mr-1">✨</span> {newCount} từ mới
                </span>
              ) : (
                <span className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  Đã xong
                </span>
              )}
            </div>
          </Link>
        </div>
    </div>
  )
}
