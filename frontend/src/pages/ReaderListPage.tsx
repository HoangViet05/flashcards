import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createArticle, createTranslationWorker, deleteArticle, getArticles, getTranslationWorkers, queueArticleTranslation, queueUntranslatedArticles } from '../api/articles'
import { API_BASE_URL } from '../api/config'
import { getDocuments } from '../api/documents'
import { useAuth } from '../auth/AuthContext'
import { useNotification } from '../components/NotificationProvider'
import { useCachedQuery } from '../hooks/useCachedQuery'
import type { Document, TranslationStatus } from '../types'
import { stripTranscriptTimestamps } from '../utils/readerText'

type Tab = 'paste' | 'url' | 'pdf'
const BADGES: Record<string, string> = { paste: '📋 Dán', url: '🔗 Web', pdf: '📄 PDF', rss: '📰 RSS' }
const TRANSLATION_BADGES: Record<TranslationStatus, { text: string; className: string }> = {
  queued: { text: 'Chờ dịch local', className: 'border-amber-300/20 bg-amber-300/10 text-amber-200' },
  processing: { text: 'Máy đang dịch', className: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200' },
  completed: { text: 'Đã có bản dịch', className: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' },
  failed: { text: 'Dịch lỗi — thử lại', className: 'border-rose-300/20 bg-rose-300/10 text-rose-200' },
}

function isRecentlyOnline(lastSeen: string | null) {
  return lastSeen !== null && Date.now() - new Date(lastSeen).getTime() < 90_000
}

export default function ReaderListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast, confirm } = useNotification()
  const articlesQuery = useCachedQuery(user ? `articles:${user.id}` : null, getArticles)
  const workersQuery = useCachedQuery(user ? `translation-workers:${user.id}` : null, getTranslationWorkers)
  const [show, setShow] = useState(false)
  const [tab, setTab] = useState<Tab>('paste')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [docId, setDocId] = useState('')
  const [docs, setDocs] = useState<Document[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [queuingAll, setQueuingAll] = useState(false)
  const [queuingArticle, setQueuingArticle] = useState<string | null>(null)
  const [pairingToken, setPairingToken] = useState<string | null>(null)
  const [pairing, setPairing] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => {
      void articlesQuery.refresh()
      void workersQuery.refresh()
    }, 15_000)
    return () => window.clearInterval(timer)
  }, [articlesQuery.refresh, workersQuery.refresh])

  const openPdf = () => {
    setTab('pdf')
    if (!docs) void getDocuments().then(setDocs).catch(() => toast('Không tải được tài liệu PDF', 'error'))
  }

  const create = async () => {
    setCreating(true)
    try {
      const input = tab === 'paste'
        ? { title: title || undefined, text: stripTranscriptTimestamps(text) }
        : tab === 'url'
          ? { title: title || undefined, url }
          : { title: title || undefined, document_id: docId }
      const article = await createArticle(input)
      setShow(false)
      setTitle('')
      setText('')
      setUrl('')
      setDocId('')
      await articlesQuery.refresh()
      navigate(`/reader/${article.id}`)
    } catch (error: any) {
      toast(error?.response?.data?.detail ?? 'Không tạo được bài đọc', 'error')
    } finally {
      setCreating(false)
    }
  }

  const remove = (id: string, name: string) => confirm({
    title: 'Xóa bài đọc?',
    message: `“${name}” sẽ bị xóa vĩnh viễn.`,
    variant: 'danger',
    confirmText: 'Xóa',
    onConfirm: () => {
      void deleteArticle(id).then(() => articlesQuery.refresh()).catch(() => toast('Không xóa được bài đọc', 'error'))
    },
  })

  const queueAll = async () => {
    setQueuingAll(true)
    try {
      const result = await queueUntranslatedArticles()
      await articlesQuery.refresh()
      toast(result.queued_count ? `Đã đưa ${result.queued_count} bài vào hàng dịch local.` : 'Không có bài mới cần dịch.', 'success')
    } catch (error: any) {
      toast(error?.response?.data?.detail ?? 'Không thể tạo hàng dịch', 'error')
    } finally {
      setQueuingAll(false)
    }
  }

  const queueOne = async (id: string, force = false) => {
    setQueuingArticle(id)
    try {
      await queueArticleTranslation(id, force)
      await articlesQuery.refresh()
      toast(force ? 'Đã yêu cầu dịch lại bài này.' : 'Đã đưa bài vào hàng dịch local.', 'success')
    } catch (error: any) {
      toast(error?.response?.data?.detail ?? 'Không thể đưa bài vào hàng dịch', 'error')
    } finally {
      setQueuingArticle(null)
    }
  }

  const pairWorker = async () => {
    setPairing(true)
    try {
      const worker = await createTranslationWorker()
      setPairingToken(worker.token)
      await workersQuery.refresh()
    } catch (error: any) {
      toast(error?.response?.data?.detail ?? 'Không tạo được mã kết nối máy local', 'error')
    } finally {
      setPairing(false)
    }
  }

  const openWorkerPairing = () => {
    if (workersQuery.data?.length) {
      toast('Máy này đã được ghép. Hãy chạy start_worker.bat khi muốn bật công tắc dịch.', 'success')
      return
    }
    void pairWorker()
  }

  const articles = articlesQuery.data ?? []
  const workers = workersQuery.data ?? []
  const workerOnline = workers.some(worker => isRecentlyOnline(worker.last_seen_at))
  const workerApiBaseUrl = API_BASE_URL.startsWith('http') ? API_BASE_URL : `${window.location.origin}${API_BASE_URL}`
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">📖 Tech Reader</h1>
          <p className="mt-1 text-sm text-slate-400">Đọc, tra từ và lưu thẻ ngay trong ngữ cảnh.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={openWorkerPairing} disabled={pairing} className={`rounded-xl border px-3 py-2 text-sm font-bold ${workerOnline ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-white/[.04] text-slate-300'}`}>
            <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${workerOnline ? 'bg-emerald-300' : 'bg-slate-500'}`} />
            {pairing ? 'Đang tạo mã…' : workerOnline ? 'Máy dịch đang bật' : 'Kết nối máy dịch'}
          </button>
          <button onClick={() => void queueAll()} disabled={queuingAll || articles.length === 0} className="rounded-xl border border-violet-300/25 bg-violet-400/10 px-3 py-2 text-sm font-bold text-violet-200 disabled:opacity-50">{queuingAll ? 'Đang xếp hàng…' : '⚡ Dịch tất cả bài mới'}</button>
          <button onClick={() => setShow(true)} className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200">+ Bài mới</button>
        </div>
      </div>

      <p className="-mt-3 mb-6 text-xs text-slate-500">Bản dịch được worker local tạo ở nền và lưu kín trong tài khoản; nội dung tiếng Anh vẫn là màn hình đọc chính.</p>

      {articlesQuery.loading ? <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-white/[.05]" />)}</div>
        : articles.length === 0 ? <p className="rounded-2xl border border-white/[.07] bg-white/[.03] p-8 text-center text-slate-400">Chưa có bài đọc nào — dán một bài báo IT hoặc JD để bắt đầu.</p>
          : <div className="grid gap-3 sm:grid-cols-2">{articles.map(article => {
            const translation = article.translation_status ? TRANSLATION_BADGES[article.translation_status] : null
            return <div key={article.id} className="group relative rounded-2xl border border-white/[.07] bg-white/[.03] p-4 hover:border-cyan-300/20">
              <Link to={`/reader/${article.id}`} className="block pr-20"><h3 className="line-clamp-2 font-bold text-slate-100">{article.title}</h3><p className="mt-2 text-xs text-slate-500">{BADGES[article.source_type]} · {article.word_count} từ · {new Date(article.created_at).toLocaleDateString('vi-VN')}</p>{translation && <span className={`mt-3 inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${translation.className}`}>{translation.text}</span>}</Link>
              <div className="absolute right-3 top-3 flex gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                <button onClick={event => { event.preventDefault(); void queueOne(article.id, article.translation_status === 'completed') }} disabled={queuingArticle === article.id} className="rounded-lg px-2 py-1 text-xs text-violet-200 hover:bg-violet-500/10 disabled:opacity-50">{queuingArticle === article.id ? '…' : article.translation_status === 'completed' ? 'Dịch lại' : 'Dịch'}</button>
                <button onClick={() => remove(article.id, article.title)} className="rounded-lg px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10">Xóa</button>
              </div>
            </div>
          })}</div>}

      {show && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShow(false)}>
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
          <h2 className="mb-4 text-lg font-black text-white">Bài đọc mới</h2>
          <div className="mb-4 flex gap-1 rounded-xl bg-black/30 p-1">
            {([['paste', '📋 Dán text'], ['url', '🔗 URL'], ['pdf', '📄 PDF']] as [Tab, string][]).map(([value, label]) => <button key={value} onClick={() => value === 'pdf' ? openPdf() : setTab(value)} className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${tab === value ? 'bg-white/10 text-white' : 'text-slate-400'}`}>{label}</button>)}
          </div>
          <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Tiêu đề (tùy chọn)" className="mb-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
          {tab === 'paste' && <>
            <textarea value={text} onChange={event => setText(stripTranscriptTimestamps(event.target.value))} rows={8} placeholder="Dán bài báo, JD, tài liệu..." className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
            <p className="mt-2 text-xs text-slate-500">Timestamp video dạng 00:00 sẽ tự được bỏ.</p>
          </>}
          {tab === 'url' && <input value={url} onChange={event => setUrl(event.target.value)} placeholder="https://example.com/..." className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500" />}
          {tab === 'pdf' && (docs === null ? <p className="text-sm text-slate-400">Đang tải danh sách tài liệu…</p> : docs.length ? <select value={docId} onChange={event => setDocId(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"><option value="">— Chọn tài liệu —</option>{docs.map(document => <option key={document.id} value={document.id}>{document.filename}</option>)}</select> : <p className="text-sm text-slate-400">Chưa có PDF — upload ở trang <Link to="/documents" className="text-cyan-300 underline">Tài liệu</Link>.</p>)}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShow(false)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-400">Hủy</button>
            <button onClick={() => void create()} disabled={creating || (tab === 'paste' ? !text.trim() : tab === 'url' ? !url.trim() : !docId)} className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200 disabled:opacity-50">{creating ? 'Đang xử lý…' : 'Tạo bài đọc'}</button>
          </div>
        </div>
      </div>}

      {pairingToken && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setPairingToken(null)}>
        <div className="w-full max-w-xl rounded-2xl border border-violet-300/20 bg-slate-950 p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
          <p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">Kết nối máy dịch local</p>
          <h2 className="mt-2 text-xl font-black text-white">Lưu mã này trước khi đóng</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Mã chỉ hiện một lần. Dán vào file <code className="text-violet-200">local_translator/.env</code> trên laptop của bạn; worker chỉ dịch các bài thuộc tài khoản này.</p>
          <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-xs text-slate-200">
            <p>API_BASE_URL={workerApiBaseUrl}</p>
            <p className="break-all">WORKER_TOKEN={pairingToken}</p>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button onClick={() => void navigator.clipboard?.writeText(`API_BASE_URL=${workerApiBaseUrl}\nWORKER_TOKEN=${pairingToken}`).then(() => toast('Đã copy cấu hình worker.', 'success'))} className="rounded-xl border border-violet-300/25 bg-violet-400/10 px-4 py-2 text-sm font-bold text-violet-100">Copy cấu hình</button>
            <button onClick={() => setPairingToken(null)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-300">Tôi đã lưu mã</button>
          </div>
        </div>
      </div>}
    </div>
  )
}
