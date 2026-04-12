import { useState } from 'react'
import type { Card } from '../types'

interface Props {
  card: Card
  onRate: (quality: number) => void
}

const RATINGS = [
  { label: 'Không nhớ', quality: 0, bg: 'bg-red-500/15 hover:bg-red-500/30 border-red-500/30 hover:border-red-400/60 text-red-300', icon: '😵' },
  { label: 'Khó', quality: 1, bg: 'bg-orange-500/15 hover:bg-orange-500/30 border-orange-500/30 hover:border-orange-400/60 text-orange-300', icon: '😓' },
  { label: 'Ổn', quality: 3, bg: 'bg-yellow-500/15 hover:bg-yellow-500/30 border-yellow-500/30 hover:border-yellow-400/60 text-yellow-300', icon: '🙂' },
  { label: 'Dễ', quality: 5, bg: 'bg-emerald-500/15 hover:bg-emerald-500/30 border-emerald-500/30 hover:border-emerald-400/60 text-emerald-300', icon: '😄' },
]

export default function FlipCard({ card, onRate }: Props) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div className="flex flex-col items-center gap-8 w-full">
      {/* Card */}
      <div
        className="w-full cursor-pointer select-none"
        style={{ perspective: '1200px' }}
        onClick={() => setFlipped(f => !f)}
      >
        <div
          className="relative w-full transition-all duration-600"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            minHeight: '260px',
            transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 rounded-[2rem] flex flex-col items-center justify-center p-8 gap-5"
            style={{
              backfaceVisibility: 'hidden',
              background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(8,8,16,0.9) 100%)',
              border: '1px solid rgba(124,58,237,0.3)',
              boxShadow: '0 30px 60px -15px rgba(124,58,237,0.25), inset 0 1px 1px rgba(255,255,255,0.1)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/10 rounded-full blur-[50px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
            
            <div className="w-16 h-16 rounded-[1.25rem] bg-gradient-to-br from-violet-500/20 to-purple-600/30 border border-violet-500/40 flex items-center justify-center text-3xl mb-2 shadow-[0_0_20px_rgba(139,92,246,0.2)]">
              🔤
            </div>
            <p className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 text-center tracking-tight drop-shadow-sm">{card.front_text}</p>
            <div className="flex items-center gap-3 mt-6">
              <span className="w-12 h-px bg-gradient-to-r from-transparent to-violet-500/50" />
              <span className="text-violet-400/80 text-xs font-bold uppercase tracking-widest bg-violet-500/10 px-3 py-1 rounded-full border border-violet-500/20">nhấn để lật</span>
              <span className="w-12 h-px bg-gradient-to-l from-transparent to-violet-500/50" />
            </div>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 rounded-[2rem] flex flex-col items-center justify-center p-8 gap-5"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: 'linear-gradient(135deg, rgba(6,182,212,0.15) 0%, rgba(8,8,16,0.95) 100%)',
              border: '1px solid rgba(6,182,212,0.3)',
              boxShadow: '0 30px 60px -15px rgba(6,182,212,0.2), inset 0 1px 1px rgba(255,255,255,0.1)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-[50px] pointer-events-none translate-y-1/2 -translate-x-1/2" />
            <p className="text-2xl sm:text-3xl font-bold text-white text-center leading-tight drop-shadow-md relative z-10">{card.back_text}</p>
            {card.example_sentence && (
              <div className="mt-2 px-5 py-3 rounded-xl bg-white/5 border border-white/8 max-w-sm">
                <p className="text-gray-400 text-sm italic text-center leading-relaxed">
                  "{card.example_sentence}"
                </p>
              </div>
            )}
            {card.image_url && (
              <img src={card.image_url} alt="" className="max-h-28 rounded-xl object-cover mt-2 border border-white/10" />
            )}
          </div>
        </div>
      </div>

      {/* Rating buttons */}
      {flipped && (
        <div className="w-full animate-fade-in-up mt-2" style={{ animationDelay: '100ms' }}>
          <p className="text-center text-gray-500 text-xs font-bold mb-4 uppercase tracking-[0.2em]">Đánh giá độ khó</p>
          <div className="grid grid-cols-4 gap-3 sm:gap-4">
            {RATINGS.map((r, i) => (
              <button
                key={r.quality}
                onClick={() => onRate(r.quality)}
                className={`group relative flex flex-col items-center gap-2 py-4 px-2 rounded-2xl border transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] hover:shadow-lg overflow-hidden bg-black/20 backdrop-blur-md ${r.bg}`}
                style={{ animationDelay: `${(i * 50) + 100}ms` }}
              >
                {/* Hover glare effect */}
                <span className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full blur-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <span className="text-2xl sm:text-3xl filter drop-shadow-md group-hover:scale-110 transition-transform">{r.icon}</span>
                <span className="text-xs sm:text-sm font-bold tracking-wide">{r.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
