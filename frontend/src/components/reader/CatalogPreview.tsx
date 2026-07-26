import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adoptCatalogArticle, getCatalogArticle } from '../../api/catalog'
import { useNotification } from '../NotificationProvider'
import { READING_LEVEL_LABELS, type CatalogDetail } from '../../types'

interface Props { catalogId: string; onClose: () => void; onAdopted: () => void }

export default function CatalogPreview({ catalogId, onClose, onAdopted }: Props) {
  const { toast } = useNotification()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<CatalogDetail | null>(null)
  const [adopting, setAdopting] = useState(false)
  useEffect(() => { let active = true; getCatalogArticle(catalogId).then(data => { if (active) setDetail(data) }).catch(() => toast('Không tải được bài đọc', 'error')); return () => { active = false } }, [catalogId, toast])
  const adopt = async () => {
    setAdopting(true)
    try { const article = await adoptCatalogArticle(catalogId); onAdopted(); navigate(`/reader/${article.id}`) }
    catch (error: any) { const body = error?.response?.data?.detail; if (body?.article_id) { navigate(`/reader/${body.article_id}`); return }; toast(typeof body === 'string' ? body : 'Không thêm được bài đọc', 'error') }
    finally { setAdopting(false) }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}><div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
    {!detail ? <div className="h-40 animate-pulse rounded-xl bg-white/[.05]" /> : <><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">{READING_LEVEL_LABELS[detail.level]}</p><h2 className="mt-2 text-xl font-black text-white">{detail.title}</h2><p className="mt-1 text-xs text-slate-500">{detail.word_count} từ · {detail.suggested_words.length} từ nên học</p><div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-white/[.07] bg-black/20 p-3 text-sm leading-7 text-slate-300">{detail.content.slice(0, 1200)}{detail.content.length > 1200 ? '…' : ''}</div>{detail.suggested_words.length > 0 && <div className="mt-4"><p className="text-xs font-bold text-slate-400">Từ nên học trong bài này</p><div className="mt-2 flex flex-wrap gap-1.5">{detail.suggested_words.map(word => <span key={word} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-xs font-bold text-cyan-100">{word}</span>)}</div></div>}<p className="mt-4 text-[11px] leading-5 text-slate-500">Nguồn: <a href={detail.source_url} target="_blank" rel="noreferrer noopener" className="text-slate-400 underline">{detail.attribution}</a></p><div className="mt-4 flex justify-end gap-2"><button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-400">Đóng</button><button onClick={() => void adopt()} disabled={adopting || detail.already_added} className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200 disabled:opacity-50">{detail.already_added ? 'Đã có trong Reader' : adopting ? 'Đang thêm…' : 'Thêm vào Reader'}</button></div></>}
  </div></div>
}
