import type { ShadowScore, ShadowWordStatus } from '../../types'
const styles: Record<ShadowWordStatus, string> = { correct: 'text-emerald-300', missed: 'text-rose-300 underline decoration-rose-400/60', substituted: 'text-amber-300 underline decoration-amber-400/60', skipped: 'text-slate-500' }
export default function ScoreDisplay({ result }: { result: ShadowScore }) {
  if (result.no_speech) return <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm font-bold text-amber-200">Không nghe rõ giọng bạn — thử lại gần mic hơn nhé.</div>
  const tone = result.score >= 80 ? 'text-emerald-300' : result.score >= 60 ? 'text-amber-300' : 'text-rose-300'
  return <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-4"><span className={`text-3xl font-black ${tone}`}>{result.score}%</span><p className="mb-2 text-lg leading-8">{result.words.map((word, index) => <span key={index} className={`${styles[word.status]} mr-1.5 font-semibold`}>{word.word}</span>)}</p><p className="text-xs text-slate-500">Whisper nghe thấy: <span className="italic text-slate-400">&quot;{result.transcript}&quot;</span></p></div>
}
