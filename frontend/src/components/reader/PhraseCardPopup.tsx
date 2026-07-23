import { useEffect, useState } from 'react'
import { createArticleCard } from '../../api/articles'
import { useNotification } from '../NotificationProvider'

interface Props {
  phrase: string
  sentence: string
  sentenceTranslation: string | null
  articleId: string
  onClose: () => void
}

export default function PhraseCardPopup({ phrase, sentence, sentenceTranslation, articleId, onClose }: Props) {
  const { toast } = useNotification()
  const [meaning, setMeaning] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // A full selected sentence has an exact Vietnamese counterpart already.
    // Shorter phrases remain editable because their translation cannot be
    // safely inferred by merely cutting words out of the translated sentence.
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '').toLowerCase()
    setMeaning(sentenceTranslation && normalize(phrase) === normalize(sentence) ? sentenceTranslation : '')
  }, [phrase, sentence, sentenceTranslation])

  const save = async () => {
    if (!meaning.trim()) return
    setSaving(true)
    try {
      await createArticleCard(articleId, {
        word: phrase,
        back_text: meaning.trim(),
        example_sentence: sentence,
      })
      toast(`Đã lưu cụm “${phrase}” vào bộ thẻ của bài đọc`, 'success')
      onClose()
    } catch (error: any) {
      toast(error?.response?.data?.detail ?? 'Không lưu được thẻ', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-3 z-50 sm:inset-auto sm:right-6 sm:top-24 sm:w-[30rem]">
      <div role="dialog" aria-modal="true" aria-label={`Lưu cụm ${phrase}`} className="flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-[0_24px_70px_rgba(0,0,0,.48)] sm:max-h-[min(76vh,44rem)]">
        <header className="flex items-start justify-between border-b border-white/[.08] px-5 py-4">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[.16em] text-cyan-300/80">Lưu cụm hoặc câu</p>
            <h3 className="text-xl font-black leading-7 text-white">{phrase}</h3>
          </div>
          <button onClick={onClose} className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[.08] hover:text-white" aria-label="Đóng form lưu cụm">✕</button>
        </header>

        <div className="space-y-3 overflow-y-auto px-4 py-4">
          <section className="rounded-xl border border-white/[.06] bg-white/[.025] px-3.5 py-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Ngữ cảnh</p>
            <p className="text-xs italic leading-5 text-slate-400">“{sentence}”</p>
          </section>
          {sentenceTranslation && <section className="rounded-xl border border-emerald-300/[.14] bg-emerald-400/[.05] px-3.5 py-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[.12em] text-emerald-200/80">Bản dịch của câu</p>
            <p className="text-sm leading-6 text-emerald-50">{sentenceTranslation}</p>
          </section>}
          <div>
            <label htmlFor="phrase-meaning" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Nghĩa tiếng Việt trên mặt sau</label>
            <textarea id="phrase-meaning" value={meaning} onChange={event => setMeaning(event.target.value)} rows={3} autoFocus placeholder="Ví dụ: được lấy cảm hứng từ vật lý" className="w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm leading-6 text-white outline-none placeholder:text-slate-500 transition focus:border-cyan-300/50" />
            <p className="mt-1.5 text-[11px] leading-4 text-slate-500">Khi bôi đen trọn câu, ô này được điền sẵn từ bản dịch. Với cụm ngắn, hãy nhập nghĩa theo ngữ cảnh.</p>
          </div>
        </div>

        <footer className="border-t border-white/[.08] bg-slate-950/70 px-4 py-3">
          <button onClick={() => void save()} disabled={saving || !meaning.trim()} className="w-full rounded-xl border border-emerald-300/25 bg-emerald-400/10 py-2.5 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-40">{saving ? 'Đang lưu…' : 'Lưu cụm vào bộ thẻ'}</button>
        </footer>
      </div>
    </div>
  )
}
