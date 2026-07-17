import { useEffect, useState } from 'react'
import { deleteAnkiLibrary, getAnkiLibrary, type AnkiLibrary } from '../api/anki'
import { useNotification } from './NotificationProvider'

interface Props {
  open: boolean
  onClose: () => void
  onDeleted: () => void | Promise<void>
}

export default function AnkiLibraryModal({ open, onClose, onDeleted }: Props) {
  const [library, setLibrary] = useState<AnkiLibrary | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { confirm, toast } = useNotification()

  const load = async (value = '') => {
    setLoading(true)
    try {
      setLibrary(await getAnkiLibrary(value))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) void load()
  }, [open])

  const handleDeleteAll = () => {
    if (!library?.total || deleting) return
    confirm({
      title: 'Xóa toàn bộ thư viện Anki?',
      message: `Bạn sắp xóa ${library.total} từ nguồn Anki. Các flashcard đã tạo để học sẽ được giữ nguyên. Hành động này không thể hoàn tác.`,
      confirmText: 'Xóa toàn bộ',
      variant: 'danger',
      onConfirm: async () => {
        setDeleting(true)
        try {
          const result = await deleteAnkiLibrary()
          setLibrary({ total: 0, sources: [], entries: [] })
          setSearch('')
          await onDeleted()
          toast(`Đã xóa ${result.entries_deleted} từ khỏi thư viện Anki`, 'success')
        } catch (error) {
          toast('Không thể xóa thư viện Anki. Vui lòng thử lại.', 'error')
        } finally {
          setDeleting(false)
        }
      },
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-label="Thư viện Anki" className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0f] shadow-[0_20px_50px_rgba(0,0,0,.5)]">
        <header className="border-b border-white/[.08] px-5 py-5 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-cyan-300">Nguồn tạo thẻ</p><h2 className="mt-1 text-2xl font-black text-white">Thư viện Anki</h2><p className="mt-1 text-sm text-slate-400">{library ? `${library.total} từ đã sẵn sàng để dùng khi lưu từ trong bài đọc.` : 'Đang tải thư viện…'}</p></div>
            <div className="flex items-center gap-1">
              {library && library.total > 0 && <button onClick={handleDeleteAll} disabled={deleting} className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-500/20 disabled:cursor-wait disabled:opacity-60">{deleting ? 'Đang xóa…' : 'Xóa toàn bộ'}</button>}
              <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-white/[.08] hover:text-white" aria-label="Đóng">✕</button>
            </div>
          </div>
          <form onSubmit={event => { event.preventDefault(); void load(search) }} className="mt-4 flex gap-2"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm từ trong thư viện…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50" /><button className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 text-sm font-bold text-cyan-100 hover:bg-cyan-400/15">Tìm</button></form>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? <div className="py-12 text-center text-sm text-slate-400">Đang tải…</div>
            : library?.entries.length ? <div className="divide-y divide-white/[.06] overflow-hidden rounded-2xl border border-white/[.07]">{library.entries.map(entry => <article key={entry.id} className="flex gap-3 bg-white/[.025] px-4 py-3.5"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-x-2"><h3 className="font-extrabold text-cyan-100">{entry.front_text}</h3>{entry.pronunciation && <span className="text-xs text-cyan-300">{entry.pronunciation}</span>}<span className="text-sm text-slate-300">{entry.back_text}</span></div>{entry.definition && <p className="mt-1 line-clamp-1 text-xs text-slate-500">{entry.definition}</p>}<div className="mt-2 flex flex-wrap gap-1.5">{entry.audio_url && <span className="rounded bg-violet-400/10 px-1.5 py-0.5 text-[10px] font-bold text-violet-200">Âm thanh</span>}{entry.image_url && <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">Hình ảnh</span>}{entry.example_sentence && <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">Ví dụ</span>}</div></div></article>)}</div>
              : <div className="py-12 text-center"><p className="font-bold text-slate-200">{search ? 'Không tìm thấy từ phù hợp' : 'Thư viện Anki đang trống'}</p><p className="mt-1 text-sm text-slate-500">{search ? 'Thử một từ khác.' : 'Hãy nhập file .apkg để bắt đầu.'}</p></div>}
        </div>
      </section>
    </div>
  )
}
