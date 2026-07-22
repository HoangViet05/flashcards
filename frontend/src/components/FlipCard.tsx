import { useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Card, ReviewSubmission, StudyVariant } from '../types'
import { resolveAssetUrl } from '../api/config'

interface Props {
  card: Card
  variant?: StudyVariant
  onRate: (submission: ReviewSubmission) => void
  onNext?: () => void
  onPrev?: () => void
  isPractice?: boolean
}

const RATINGS = [
  { label: 'Không nhớ', quality: 0, bg: 'bg-red-500/15 hover:bg-red-500/30 border-red-500/30 hover:border-red-400/60 text-red-300', icon: '😵', hint: 'Sai hoặc không nhớ được.' },
  { label: 'Khó', quality: 1, bg: 'bg-orange-500/15 hover:bg-orange-500/30 border-orange-500/30 hover:border-orange-400/60 text-orange-300', icon: '😓', hint: 'Nhớ chậm, cần gợi ý hoặc thử lại.' },
  { label: 'Ổn', quality: 3, bg: 'bg-yellow-500/15 hover:bg-yellow-500/30 border-yellow-500/30 hover:border-yellow-400/60 text-yellow-300', icon: '🙂', hint: 'Trả lời đúng nhưng chưa thật nhanh.' },
  { label: 'Dễ', quality: 5, bg: 'bg-emerald-500/15 hover:bg-emerald-500/30 border-emerald-500/30 hover:border-emerald-400/60 text-emerald-300', icon: '😄', hint: 'Nhớ nhanh và ít cần hỗ trợ.' },
]

const SELF_CHECK_FAST_MS = 5000
const SELF_CHECK_OK_MS = 12000
const TYPED_FAST_MS = 8000
const TYPED_OK_MS = 15000

function normalizeAnswer(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:()[\]{}"']/g, '')
    .replace(/\s+/g, ' ')
}

function makeClozeText(sentence: string | null, target: string) {
  if (!sentence) return ''

  const lowerSentence = sentence.toLowerCase()
  const lowerTarget = target.toLowerCase().trim()
  const index = lowerSentence.indexOf(lowerTarget)

  if (index < 0) return sentence

  return `${sentence.slice(0, index)}______${sentence.slice(index + target.length)}`
}

function getRating(quality: number) {
  if (quality >= 5) return RATINGS[3]
  if (quality >= 3) return RATINGS[2]
  if (quality >= 1) return RATINGS[1]
  return RATINGS[0]
}

function formatSeconds(ms: number) {
  return `${Math.max(1, Math.round(ms / 1000))}s`
}

function inferSelfCheckQuality(responseTimeMs: number, flipCount: number, audioPlayCount: number) {
  if (responseTimeMs <= SELF_CHECK_FAST_MS && flipCount <= 1 && audioPlayCount <= 1) {
    return {
      quality: 5,
      reason: `Bạn lật thẻ sau ${formatSeconds(responseTimeMs)} và gần như không cần hỗ trợ.`,
    }
  }

  if (responseTimeMs <= SELF_CHECK_OK_MS && flipCount <= 2 && audioPlayCount <= 2) {
    return {
      quality: 3,
      reason: `Bạn cần ${formatSeconds(responseTimeMs)} trước khi xem đáp án.`,
    }
  }

  return {
    quality: 1,
    reason: `Bạn mất ${formatSeconds(responseTimeMs)} hoặc cần nghe/lật lại nhiều lần.`,
  }
}

function inferTypedAnswerQuality(correct: boolean, responseTimeMs: number, attempts: number) {
  if (!correct) {
    return {
      quality: 0,
      reason: 'Câu trả lời chưa đúng trong lần kiểm tra này.',
    }
  }

  if (attempts <= 1 && responseTimeMs <= TYPED_FAST_MS) {
    return {
      quality: 5,
      reason: `Bạn trả lời đúng ngay trong ${formatSeconds(responseTimeMs)}.`,
    }
  }

  if (attempts <= 1 && responseTimeMs <= TYPED_OK_MS) {
    return {
      quality: 3,
      reason: `Bạn trả lời đúng sau ${formatSeconds(responseTimeMs)}.`,
    }
  }

  return {
    quality: 1,
    reason: attempts > 1
      ? `Bạn trả lời đúng sau ${attempts} lần thử.`
      : `Bạn trả lời đúng nhưng cần ${formatSeconds(responseTimeMs)}.`,
  }
}

function AudioButton({ src, fallbackText, small, onPlay }: { src?: string | null; fallbackText?: string; small?: boolean; onPlay?: () => void }) {
  const resolvedSrc = resolveAssetUrl(src)
  const play = (e: MouseEvent) => {
    e.stopPropagation()
    onPlay?.()
    if (resolvedSrc) {
      new Audio(resolvedSrc).play().catch(() => {})
      return
    }
    if (fallbackText) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(fallbackText)
      utterance.lang = 'en-US'
      utterance.rate = 0.9
      window.speechSynthesis.speak(utterance)
    }
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

function AutoAssessment({
  quality,
  reason,
  onAccept,
}: {
  quality: number
  reason: string
  onAccept: () => void
}) {
  const rating = getRating(quality)

  return (
    <div className="w-full max-w-2xl mx-auto rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] px-4 py-4 sm:px-5 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.68rem] uppercase tracking-[0.2em] text-cyan-300/80 font-bold mb-2">Đánh giá tự động</p>
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">{rating.icon}</span>
            <div className="min-w-0">
              <p className="font-extrabold text-white">{rating.label}</p>
              <p className="text-sm text-gray-400 leading-relaxed">{reason}</p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onAccept}
          className="btn-primary shrink-0 px-4 py-3 rounded-2xl font-bold text-sm"
        >
          Dùng đánh giá này
        </button>
      </div>
    </div>
  )
}

export default function FlipCard({ card, variant = 'standard', onRate, onNext, onPrev, isPractice }: Props) {
  const [flipped, setFlipped] = useState(false)
  const [answer, setAnswer] = useState('')
  const [checked, setChecked] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null)
  const [flipCount, setFlipCount] = useState(0)
  const [audioPlayCount, setAudioPlayCount] = useState(0)
  const startedAtRef = useRef(Date.now())
  const imageUrl = resolveAssetUrl(card.image_url)
  const isAnswerMode = variant === 'cloze' || variant === 'reverse'
  const expectedAnswer = card.front_text
  const answerIsCorrect = normalizeAnswer(answer) === normalizeAnswer(expectedAnswer)

  const elapsedMs = () => Math.max(0, Date.now() - startedAtRef.current)

  const selfCheckAssessment = useMemo(() => {
    const measuredMs = responseTimeMs ?? elapsedMs()
    return inferSelfCheckQuality(measuredMs, flipCount, audioPlayCount)
  }, [responseTimeMs, flipCount, audioPlayCount])

  const typedAnswerAssessment = useMemo(() => {
    if (!checked || responseTimeMs == null) return null
    return inferTypedAnswerQuality(answerIsCorrect, responseTimeMs, attempts)
  }, [answerIsCorrect, attempts, checked, responseTimeMs])

  const makeSubmission = (
    quality: number,
    ratingSource: 'manual' | 'auto',
    autoQuality: number | null,
    answerMode: ReviewSubmission['answer_mode'],
    answerCorrect: boolean | null,
  ): ReviewSubmission => ({
    quality,
    auto_quality: autoQuality,
    rating_source: ratingSource,
    response_time_ms: responseTimeMs ?? elapsedMs(),
    flip_count: flipCount,
    audio_play_count: audioPlayCount,
    answer_mode: answerMode,
    answer_correct: answerCorrect,
    attempt_count: attempts || null,
  })

  const handleManualRate = (quality: number, answerMode: ReviewSubmission['answer_mode'], answerCorrect: boolean | null, autoQuality: number | null) => {
    onRate(makeSubmission(quality, 'manual', autoQuality, answerMode, answerCorrect))
  }

  const handleAutoRate = (quality: number, answerMode: ReviewSubmission['answer_mode'], answerCorrect: boolean | null) => {
    onRate(makeSubmission(quality, 'auto', quality, answerMode, answerCorrect))
  }

  const handleCheckAnswer = () => {
    if (!answer.trim()) return
    setAttempts(value => value + 1)
    setResponseTimeMs(elapsedMs())
    setChecked(true)
  }

  const handleCardFlip = () => {
    const nextFlipped = !flipped
    setFlipped(nextFlipped)
    setFlipCount(value => value + 1)
    if (nextFlipped && responseTimeMs == null) {
      setResponseTimeMs(elapsedMs())
    }
  }

  if (isAnswerMode) {
    const promptTitle = variant === 'cloze' ? 'Điền vào chỗ trống' : 'Thẻ đảo ngược'
    const promptText = variant === 'cloze' ? makeClozeText(card.example_sentence, card.front_text) : card.back_text

    return (
      <div className="flex flex-col items-center gap-5 sm:gap-8 w-full">
        <div
          className="relative w-full rounded-[2rem] flex flex-col items-center justify-center p-5 sm:p-8 gap-5 sm:gap-6 overflow-hidden min-h-[clamp(340px,58vh,460px)]"
          style={{
            background: variant === 'cloze'
              ? 'linear-gradient(135deg, rgba(245,158,11,0.14) 0%, rgba(8,8,16,0.94) 100%)'
              : 'linear-gradient(135deg, rgba(6,182,212,0.16) 0%, rgba(8,8,16,0.95) 100%)',
            border: variant === 'cloze' ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(6,182,212,0.3)',
            boxShadow: '0 30px 60px -15px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.1)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-[50px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-5">
            <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${variant === 'cloze' ? 'text-amber-300 bg-amber-500/10 border-amber-500/25' : 'text-cyan-300 bg-cyan-500/10 border-cyan-500/25'}`}>
              {promptTitle}
            </span>

            {variant === 'reverse' && imageUrl && (
              <img
                src={imageUrl}
                alt=""
                className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl object-cover border border-white/10 shadow-[0_18px_45px_rgba(6,182,212,0.18)]"
              />
            )}

            <p className="max-w-full break-words text-2xl sm:text-4xl font-extrabold text-white text-center leading-tight drop-shadow-sm">
              {promptText}
            </p>

            <div className="w-full max-w-md flex flex-col gap-3">
              <input
                value={answer}
                onChange={e => {
                  setAnswer(e.target.value)
                  setChecked(false)
                  setResponseTimeMs(null)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCheckAnswer()
                }}
                placeholder="Gõ từ tiếng Anh..."
                className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-5 py-4 text-cyan-100 font-bold text-lg text-center placeholder-gray-600 focus:bg-white/[0.06] focus:border-cyan-500/50 transition-all outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={handleCheckAnswer}
                disabled={!answer.trim()}
                className="btn-primary px-5 py-3 rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Kiểm tra
              </button>
            </div>

            {checked && (
              <div className={`w-full max-w-md rounded-2xl border px-5 py-4 text-center ${answerIsCorrect ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-red-500/10 border-red-500/30 text-red-200'}`}>
                <p className="text-sm font-bold uppercase tracking-wider mb-1">
                  {answerIsCorrect ? 'Chính xác' : 'Đáp án đúng'}
                </p>
                <p className="text-2xl font-extrabold break-words">{expectedAnswer}</p>
                {card.pronunciation && <p className="text-sm text-gray-300 mt-1">{card.pronunciation}</p>}
              </div>
            )}
          </div>
        </div>

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

        {!isPractice && checked && (
          <div className="w-full animate-fade-in-up mt-2" style={{ animationDelay: '100ms' }}>
            {typedAnswerAssessment && (
              <div className="mb-4">
                <AutoAssessment
                  quality={typedAnswerAssessment.quality}
                  reason={typedAnswerAssessment.reason}
                  onAccept={() => handleAutoRate(typedAnswerAssessment.quality, 'typed-answer', answerIsCorrect)}
                />
              </div>
            )}
            <p className="text-center text-gray-500 text-xs font-bold mb-4 uppercase tracking-[0.2em]">Đánh giá độ khó</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {RATINGS.map((r, i) => (
                <button
                  key={r.quality}
                  onClick={() => handleManualRate(r.quality, 'typed-answer', answerIsCorrect, typedAnswerAssessment?.quality ?? null)}
                  className={`group relative flex flex-col items-center gap-2 py-4 px-2 rounded-2xl border transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] hover:shadow-lg overflow-hidden bg-black/20 backdrop-blur-md ${r.bg}`}
                  style={{ animationDelay: `${(i * 50) + 100}ms` }}
                  title={r.hint}
                >
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

  return (
    <div className="flex flex-col items-center gap-5 sm:gap-8 w-full">
      {/* Card */}
      <div
        className="w-full cursor-pointer select-none"
        style={{ perspective: '1200px' }}
        onClick={handleCardFlip}
      >
        <div
          className="relative w-full transition-all duration-600"
          style={{
            display: 'grid',
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            minHeight: 'clamp(320px, 58vh, 440px)',
            transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Front */}
          <div
            className="relative rounded-[2rem] flex flex-col items-center justify-center p-5 sm:p-8 gap-4 sm:gap-5 overflow-hidden"
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
            {card.source_type === 'anki_library' && <span title={card.source_name ? `Nguồn: ${card.source_name}` : 'Dữ liệu từ thư viện Anki'} className="absolute left-5 top-5 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-100">Thư viện Anki</span>}
            
            <p className="max-w-full break-words text-3xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 text-center tracking-tight drop-shadow-sm">{card.front_text}</p>
            {card.pronunciation && (
              <p className="text-cyan-200/70 text-lg sm:text-xl font-medium tracking-wide text-center break-words">{card.pronunciation}</p>
            )}
            <AudioButton src={card.audio_url} fallbackText={card.front_text} onPlay={() => setAudioPlayCount(value => value + 1)} />
            <div className="flex items-center gap-2 sm:gap-3 mt-4 sm:mt-6">
              <span className="w-8 sm:w-12 h-px bg-gradient-to-r from-transparent to-violet-500/50" />
              <span className="text-violet-400/80 text-xs font-bold uppercase tracking-widest bg-violet-500/10 px-3 py-1 rounded-full border border-violet-500/20">nhấn để lật</span>
              <span className="w-8 sm:w-12 h-px bg-gradient-to-l from-transparent to-violet-500/50" />
            </div>
          </div>

          {/* Back */}
          <div
            className="relative rounded-[2rem] flex flex-col items-center justify-center p-5 sm:p-8 gap-4 sm:gap-5 overflow-hidden"
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
            {card.source_type === 'anki_library' && <span title={card.source_name ? `Nguồn: ${card.source_name}` : 'Dữ liệu từ thư viện Anki'} className="absolute left-5 top-5 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-100">Thư viện Anki</span>}
            <div className={`relative z-10 w-full max-w-2xl flex ${imageUrl ? 'flex-col md:flex-row' : 'flex-col'} items-center justify-center gap-7`}>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt=""
                  className="w-40 h-40 sm:w-52 sm:h-52 rounded-2xl object-cover border border-white/10 shadow-[0_18px_45px_rgba(6,182,212,0.18)] shrink-0"
                />
              )}
              <div className="flex flex-col items-center justify-center gap-4 sm:gap-5 min-w-0 max-w-full">
                <p className="max-w-full break-words text-xl sm:text-3xl font-bold text-white text-center leading-tight drop-shadow-md">{card.back_text}</p>
                {card.definition && (
                  <p className="text-gray-300 text-sm sm:text-base text-center leading-relaxed max-w-md break-words">{card.definition}</p>
                )}
                {card.example_sentence && (
                  <div className="mt-2 px-4 sm:px-5 py-3 rounded-xl bg-white/5 border border-white/8 max-w-full sm:max-w-sm flex items-center gap-3">
                    <p className="text-gray-400 text-sm italic text-center leading-relaxed flex-1">
                      "{card.example_sentence}"
                    </p>
                    {card.example_audio_url && <AudioButton src={card.example_audio_url} small onPlay={() => setAudioPlayCount(value => value + 1)} />}
                    {card.example_audio_url && <Link to={`/shadowing?card=${card.id}`} onClick={event => event.stopPropagation()} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-sm shrink-0" title="Luyện shadowing câu này">🎤</Link>}
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
              <div className="mb-4">
                <AutoAssessment
                  quality={selfCheckAssessment.quality}
                  reason={selfCheckAssessment.reason}
                  onAccept={() => handleAutoRate(selfCheckAssessment.quality, 'self-check', null)}
                />
              </div>
              <p className="text-center text-gray-500 text-xs font-bold mb-4 uppercase tracking-[0.2em]">Đánh giá độ khó</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {RATINGS.map((r, i) => (
                  <button
                    key={r.quality}
                    onClick={() => handleManualRate(r.quality, 'self-check', null, selfCheckAssessment.quality)}
                    className={`group relative flex flex-col items-center gap-2 py-4 px-2 rounded-2xl border transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] hover:shadow-lg overflow-hidden bg-black/20 backdrop-blur-md ${r.bg}`}
                    style={{ animationDelay: `${(i * 50) + 100}ms` }}
                    title={r.hint}
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
