import { useState } from 'react'
import type { Card } from '../types'
import { resolveAssetUrl } from '../api/config'

interface Props {
  card: Card
  onRate: (quality: number) => void
  onNext?: () => void
  onPrev?: () => void
  isPractice?: boolean
}

const RATINGS = [
  { label: 'Không nhớ', quality: 0, bg: 'bg-red-500/15 hover:bg-red-500/30 border-red-500/30 hover:border-red-400/60 text-red-300', icon: '😵' },
  { label: 'Khó', quality: 1, bg: 'bg-orange-500/15 hover:bg-orange-500/30 border-orange-500/30 hover:border-orange-400/60 text-orange-300', icon: '😓' },
  { label: 'Ổn', quality: 3, bg: 'bg-yellow-500/15 hover:bg-yellow-500/30 border-yellow-500/30 hover:border-yellow-400/60 text-yellow-300', icon: '🙂' },
  { label: 'Dễ', quality: 5, bg: 'bg-emerald-500/15 hover:bg-emerald-500/30 border-emerald-500/30 hover:border-emerald-400/60 text-emerald-300', icon: '😄' },
]

function AudioButton({ src, small }: { src: string; small?: boolean }) {
  const resolvedSrc = resolveAssetUrl(src)
  const play = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (resolvedSrc) new Audio(resolvedSrc).play().catch(() => {})
  }
  return (
    <button
      onClick={play}
      className={`${small ? 'w-8 h-8 text-sm' : 'w-11 h-11 text-lg'} rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shrink-0`}
      title="Phát âm thanh"
    >
      🔊
    </button>
  )
}

export default function FlipCard({ card, onRate, onNext, onPrev, isPractice }: Props) {
  const [flipped, setFlipped] = useState(false)
  const imageUrl = resolveAssetUrl(card.image_url)

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
            display: 'grid',
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            minHeight: '440px',
            transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Front */}
          <div
            className="rounded-[2rem] flex flex-col items-center justify-center p-8 gap-5"
            style={{
              gridArea: '1 / 1',
              backfaceVisibility: 'hidden',
              background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(8,8,16,0.9) 100%)',
              border: '1px solid rgba(124,58,237,0.3)',
              boxShadow: '0 30px 60px -15px rgba(124,58,237,0.25), inset 0 1px 1px rgba(255,255,255,0.1)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/10 rounded-full blur-[50px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
            
            <p className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 text-center tracking-tight drop-shadow-sm">{card.front_text}</p>
            {card.pronunciation && (
              <p className="text-cyan-200/70 text-xl font-medium tracking-wide">{card.pronunciation}</p>
            )}
            {card.audio_url && <AudioButton src={card.audio_url} />}
            <div className="flex items-center gap-3 mt-6">
              <span className="w-12 h-px bg-gradient-to-r from-transparent to-violet-500/50" />
              <span className="text-violet-400/80 text-xs font-bold uppercase tracking-widest bg-violet-500/10 px-3 py-1 rounded-full border border-violet-500/20">nhấn để lật</span>
              <span className="w-12 h-px bg-gradient-to-l from-transparent to-violet-500/50" />
            </div>
          </div>

          {/* Back */}
          <div
            className="rounded-[2rem] flex flex-col items-center justify-center p-8 gap-5"
            style={{
              gridArea: '1 / 1',
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: 'linear-gradient(135deg, rgba(6,182,212,0.15) 0%, rgba(8,8,16,0.95) 100%)',
              border: '1px solid rgba(6,182,212,0.3)',
              boxShadow: '0 30px 60px -15px rgba(6,182,212,0.2), inset 0 1px 1px rgba(255,255,255,0.1)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-[50px] pointer-events-none translate-y-1/2 -translate-x-1/2" />
            <div className={`relative z-10 w-full max-w-2xl flex ${imageUrl ? 'flex-col md:flex-row' : 'flex-col'} items-center justify-center gap-7`}>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt=""
                  className="w-40 h-40 sm:w-52 sm:h-52 rounded-2xl object-cover border border-white/10 shadow-[0_18px_45px_rgba(6,182,212,0.18)] shrink-0"
                />
              )}
              <div className="flex flex-col items-center justify-center gap-5 min-w-0">
                <p className="text-2xl sm:text-3xl font-bold text-white text-center leading-tight drop-shadow-md">{card.back_text}</p>
                {card.definition && (
                  <p className="text-gray-300 text-base text-center leading-relaxed max-w-md">{card.definition}</p>
                )}
                {card.example_sentence && (
                  <div className="mt-2 px-5 py-3 rounded-xl bg-white/5 border border-white/8 max-w-sm flex items-center gap-3">
                    <p className="text-gray-400 text-sm italic text-center leading-relaxed flex-1">
                      "{card.example_sentence}"
                    </p>
                    {card.example_audio_url && <AudioButton src={card.example_audio_url} small />}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Practice navigation */}
      {isPractice && (
        <div className="w-full mt-2">
          <div className="flex justify-center gap-3 mt-2 w-full max-w-md mx-auto">
            <button
              onClick={onPrev}
              disabled={!onPrev}
              className="btn-secondary flex-1 px-4 py-3.5 rounded-2xl font-bold flex items-center justify-center shadow-[0_4px_20px_rgba(6,182,212,0.15)] hover:scale-[1.02] transition-all text-sm sm:text-base border border-cyan-500/30 text-cyan-200/80 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Quay lại
            </button>
            <button
              onClick={onNext}
              className="btn-primary flex-1 px-4 py-3.5 rounded-2xl font-bold flex items-center justify-center shadow-[0_4px_20px_rgba(124,58,237,0.3)] hover:scale-[1.02] transition-all text-sm sm:text-base border border-violet-500/40"
            >
              Tiếp theo
            </button>
          </div>
        </div>
      )}

      {/* Rating buttons */}
      {!isPractice && flipped && (
        <div className="w-full animate-fade-in-up mt-2" style={{ animationDelay: '100ms' }}>
          {isPractice ? (
            <div className="flex justify-center gap-3 mt-2 w-full max-w-md mx-auto">
              <button
                onClick={onPrev}
                disabled={!onPrev}
                className="btn-secondary flex-1 px-4 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(6,182,212,0.15)] hover:scale-[1.02] transition-all text-sm sm:text-base border border-cyan-500/30 text-cyan-200/80 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span>⬅️</span> Quay lại
              </button>
              <button
                onClick={onNext}
                className="btn-primary flex-1 px-4 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(124,58,237,0.3)] hover:scale-[1.02] transition-all text-sm sm:text-base border border-violet-500/40"
              >
                Tiếp theo <span>➡️</span>
              </button>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}
    </div>
  )
}
