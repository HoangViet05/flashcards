import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createArticle, createTranslationWorker, deleteArticle, getArticles, getTranslationWorkers, queueArticleTranslation, queueUntranslatedArticles } from '../api/articles'
import { API_BASE_URL } from '../api/config'
import { useAuth } from '../auth/AuthContext'
import { useNotification } from '../components/NotificationProvider'
import DailyStatusHero from '../components/daily/DailyStatusHero'
import CatalogTab from '../components/reader/CatalogTab'
import { useCachedQuery } from '../hooks/useCachedQuery'
import type { TranslationStatus } from '../types'
import { stripTranscriptTimestamps } from '../utils/readerText'
import '../components/core/CoreExperiences.css'
import { useOrbitalShell } from '../components/shell/OrbitalShellContext'

type Tab = 'paste' | 'url'
const BADGES: Record<string, string> = { paste: 'Pasted text', url: 'Web article', pdf: 'PDF', rss: 'RSS' }
const TRANSLATION_BADGES: Record<TranslationStatus, { text: string; className: string }> = {
  queued: { text: 'Translation queued', className: 'border-amber-300/20 bg-amber-300/10 text-amber-200' },
  processing: { text: 'Translating', className: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200' },
  completed: { text: 'Translation ready', className: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' },
  failed: { text: 'Translation failed — retry', className: 'border-rose-300/20 bg-rose-300/10 text-rose-200' },
}

function isRecentlyOnline(lastSeen: string | null) {
  return lastSeen !== null && Date.now() - new Date(lastSeen).getTime() < 90_000
}

export default function ReaderListPage() {
  const { setHeader } = useOrbitalShell()
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
  const [creating, setCreating] = useState(false)
  const [queuingAll, setQueuingAll] = useState(false)
  const [queuingArticle, setQueuingArticle] = useState<string | null>(null)
  const [pairingToken, setPairingToken] = useState<string | null>(null)
  const [pairing, setPairing] = useState(false)
  const [view, setView] = useState<'mine' | 'catalog'>('mine')

  useEffect(() => { setHeader({ eyebrow: 'FOCUS READER', title: 'Your reading library', streak: null }) }, [setHeader])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void articlesQuery.refresh()
      void workersQuery.refresh()
    }, 15_000)
    return () => window.clearInterval(timer)
  }, [articlesQuery.refresh, workersQuery.refresh])

  const create = async () => {
    setCreating(true)
    try {
      const input = tab === 'paste'
        ? { title: title || undefined, text: stripTranscriptTimestamps(text) }
        : { title: title || undefined, url }
      const article = await createArticle(input)
      setShow(false)
      setTitle('')
      setText('')
      setUrl('')
      await articlesQuery.refresh()
      navigate(`/reader/${article.id}`)
    } catch (error: any) {
      toast(error?.response?.data?.detail ?? 'The reading could not be created.', 'error')
    } finally {
      setCreating(false)
    }
  }

  const remove = (id: string, name: string) => confirm({
    title: 'Delete this reading?',
    message: `“${name}” will be removed permanently.`,
    variant: 'danger',
    confirmText: 'Delete',
    onConfirm: () => {
      void deleteArticle(id).then(() => articlesQuery.refresh()).catch(() => toast('The reading could not be deleted.', 'error'))
    },
  })

  const queueAll = async () => {
    setQueuingAll(true)
    try {
      const result = await queueUntranslatedArticles()
      await articlesQuery.refresh()
      toast(result.queued_count ? `Queued ${result.queued_count} readings for local translation.` : 'There are no new readings to translate.', 'success')
    } catch (error: any) {
      toast(error?.response?.data?.detail ?? 'The translation queue could not be created.', 'error')
    } finally {
      setQueuingAll(false)
    }
  }

  const queueOne = async (id: string, force = false) => {
    setQueuingArticle(id)
    try {
      await queueArticleTranslation(id, force)
      await articlesQuery.refresh()
      toast(force ? 'Requested a new translation for this reading.' : 'Queued this reading for local translation.', 'success')
    } catch (error: any) {
      toast(error?.response?.data?.detail ?? 'This reading could not be queued for translation.', 'error')
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
      toast(error?.response?.data?.detail ?? 'A local-worker pairing code could not be created.', 'error')
    } finally {
      setPairing(false)
    }
  }

  const openWorkerPairing = () => {
    if (workersQuery.data?.length) {
      toast('This device is already paired. Run start_worker.bat when you want to enable translation.', 'success')
      return
    }
    void pairWorker()
  }

  const articles = articlesQuery.data ?? []
  const workers = workersQuery.data ?? []
  const workerOnline = workers.some(worker => isRecentlyOnline(worker.last_seen_at))
  const workerApiBaseUrl = API_BASE_URL.startsWith('http') ? API_BASE_URL : `${window.location.origin}${API_BASE_URL}`
  return (
    <div className="reader-discovery mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Reading library</h1>
          <p className="mt-1 text-sm text-slate-400">Read, look up language, and save context without leaving the idea.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={openWorkerPairing} disabled={pairing} className={`rounded-xl border px-3 py-2 text-sm font-bold ${workerOnline ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-white/[.04] text-slate-300'}`}>
            <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${workerOnline ? 'bg-emerald-300' : 'bg-slate-500'}`} />
            {pairing ? 'Creating connection…' : workerOnline ? 'Translation worker online' : 'Connect translation worker'}
          </button>
          {view === 'mine' && <>
            <button onClick={() => void queueAll()} disabled={queuingAll || articles.length === 0} className="rounded-xl border border-violet-300/25 bg-violet-400/10 px-3 py-2 text-sm font-bold text-violet-200 disabled:opacity-50">{queuingAll ? 'Queueing…' : 'Translate new readings'}</button>
            <button onClick={() => setShow(true)} className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200">New reading</button>
          </>}
        </div>
      </div>

      <p className="-mt-3 mb-6 text-xs text-slate-500">Translations run privately in the background. The original English reading remains the primary surface.</p>

      {view === 'mine' && articles.length > 0 && <Link to={`/reader/${articles[0].id}`} className="reader-discovery__continue">
        <span>Continue reading</span><strong>{articles[0].title}</strong><small>{articles[0].word_count} words · open your companion dock</small><b>Resume →</b>
      </Link>}

      <div className="mb-5 flex gap-1 rounded-xl bg-black/30 p-1">
        {([['mine', 'My readings'], ['catalog', 'Level library']] as ['mine' | 'catalog', string][]).map(([value, label]) => <button key={value} onClick={() => setView(value)} className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition ${view === value ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{label}</button>)}
      </div>

      {view === 'catalog' ? <CatalogTab onAdopted={() => void articlesQuery.refresh()} /> : articlesQuery.loading ? <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-white/[.05]" />)}</div>
        : articles.length === 0 ? <DailyStatusHero kind="reader" primaryTo="/reader" primaryLabel="Add a reading" onPrimary={() => setShow(true)} secondaryTo="/" secondaryLabel="Return to Today" />
          : <div className="reader-discovery__library grid gap-3 sm:grid-cols-2">{articles.map(article => {
            const translation = article.translation_status ? TRANSLATION_BADGES[article.translation_status] : null
            return <div key={article.id} className="reader-discovery__card group relative flex flex-col rounded-2xl border border-white/[.07] bg-white/[.03] p-4 hover:border-cyan-300/20">
              <Link to={`/reader/${article.id}`} className="reader-discovery__card-link block"><h3 className="line-clamp-2 font-bold text-slate-100">{article.title}</h3><p className="mt-2 text-xs text-slate-500">{BADGES[article.source_type]} · {article.word_count} từ · {new Date(article.created_at).toLocaleDateString('vi-VN')}</p>{translation && <span className={`mt-3 inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${translation.className}`}>{translation.text}</span>}</Link>
              <div className="reader-discovery__card-actions mt-auto flex flex-wrap items-center gap-1 pt-4">
                <button onClick={() => void queueOne(article.id, article.translation_status === 'completed')} disabled={queuingArticle === article.id} className="whitespace-nowrap rounded-lg px-2 py-1 text-xs text-violet-200 hover:bg-violet-500/10 disabled:opacity-50">{queuingArticle === article.id ? '…' : article.translation_status === 'completed' ? 'Dịch lại' : 'Dịch'}</button>
                <button onClick={() => remove(article.id, article.title)} className="whitespace-nowrap rounded-lg px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10">Xóa</button>
              </div>
            </div>
          })}</div>}

      {show && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShow(false)}>
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
          <h2 className="mb-4 text-lg font-black text-white">New reading</h2>
          <div className="mb-4 flex gap-1 rounded-xl bg-black/30 p-1">
            {([['paste', 'Paste text'], ['url', 'URL']] as [Tab, string][]).map(([value, label]) => <button key={value} onClick={() => setTab(value)} className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${tab === value ? 'bg-white/10 text-white' : 'text-slate-400'}`}>{label}</button>)}
          </div>
          <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Title (optional)" className="mb-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
          {tab === 'paste' && <>
            <textarea value={text} onChange={event => setText(stripTranscriptTimestamps(event.target.value))} rows={8} placeholder="Paste an article, job description, or document…" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
            <p className="mt-2 text-xs text-slate-500">Video timestamps such as 00:00 are removed automatically.</p>
          </>}
          {tab === 'url' && <input value={url} onChange={event => setUrl(event.target.value)} placeholder="https://example.com/..." className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500" />}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShow(false)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-400">Cancel</button>
            <button onClick={() => void create()} disabled={creating || (tab === 'paste' ? !text.trim() : !url.trim())} className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200 disabled:opacity-50">{creating ? 'Creating…' : 'Create reading'}</button>
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
