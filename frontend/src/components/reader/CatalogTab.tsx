import { useEffect, useState } from 'react'
import { getCatalog } from '../../api/catalog'
import { updatePreferences } from '../../api/auth'
import { useAuth } from '../../auth/AuthContext'
import { useNotification } from '../NotificationProvider'
import { READING_LEVEL_LABELS, type CatalogListItem, type ReadingLevel } from '../../types'
import CatalogPreview from './CatalogPreview'

const LEVELS: ReadingLevel[] = [1, 2, 3]
const SOURCE_LABELS: Record<string, string> = { voa: 'VOA Learning English', simplewiki: 'Simple Wikipedia' }

export default function CatalogTab({ onAdopted }: { onAdopted: () => void }) {
  const { user, setUser } = useAuth(); const { toast } = useNotification()
  const [level, setLevel] = useState<ReadingLevel>(user?.preferred_level ?? 1)
  const [items, setItems] = useState<CatalogListItem[] | null>(null); const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => { let active = true; setItems(null); getCatalog(level).then(data => { if (active) setItems(data) }).catch(() => { if (active) { setItems([]); toast('Không tải được thư viện', 'error') } }); return () => { active = false } }, [level, toast])
  const chooseLevel = (next: ReadingLevel) => { setLevel(next); void updatePreferences(next).then(setUser).catch(() => undefined) }
  const reload = () => { void getCatalog(level).then(setItems).catch(() => undefined); onAdopted() }
  return <><div className="mb-4 flex flex-wrap gap-2">{LEVELS.map(value => <button key={value} onClick={() => chooseLevel(value)} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${value === level ? 'border-cyan-300/30 bg-cyan-400/15 text-cyan-100' : 'border-white/10 bg-white/[.04] text-slate-400 hover:bg-white/[.07]'}`}>{READING_LEVEL_LABELS[value]}</button>)}</div>{items === null ? <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-white/[.05]" />)}</div> : items.length === 0 ? <p className="rounded-2xl border border-white/[.07] bg-white/[.03] p-6 text-center text-sm text-slate-400">Chưa có bài nào ở bậc này. Chạy <code className="text-slate-300">python scripts/import_catalog.py</code> để nạp thư viện.</p> : <div className="grid gap-3 sm:grid-cols-2">{items.map(item => <button key={item.id} onClick={() => setPreview(item.id)} className="rounded-2xl border border-white/[.07] bg-white/[.03] p-4 text-left transition hover:border-cyan-300/20"><h3 className="line-clamp-2 font-bold text-slate-100">{item.title}</h3><p className="mt-2 text-xs text-slate-500">{SOURCE_LABELS[item.source] ?? item.source} · {item.word_count} từ · {item.suggested_word_count} từ nên học</p>{item.already_added && <span className="mt-3 inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[11px] font-bold text-emerald-200">Đã có trong Reader</span>}</button>)}</div>}{preview && <CatalogPreview catalogId={preview} onClose={() => setPreview(null)} onAdopted={reload} />}</>
}
