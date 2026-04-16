import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getDocument } from '../api/documents'
import { Document, Deck } from '../types'
import { getDecks } from '../api/decks'
import { useNotification } from '../components/NotificationProvider'

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [doc, setDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [decks, setDecks] = useState<Deck[]>([])
  const { toast } = useNotification()

  // Generation form state
  const [deckId, setDeckId] = useState('')
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(5)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!id) return
    const fetchData = async () => {
      try {
        setLoading(true)
        const [docData, decksData] = await Promise.all([
          getDocument(id),
          getDecks()
        ])
        setDoc(docData)
        setDecks(decksData)
        if (decksData.length > 0) {
          setDeckId(decksData[0].id)
        }
      } catch (e) {
        console.error(e)
        toast('Không thể tải dữ liệu tài liệu', 'error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deckId || !topic) {
      toast('Vui lòng điền đủ thông tin', 'error')
      return
    }

    setGenerating(true)
    // TODO: Call API to generate cards from this document
    // e.g. await client.post('/api/ai/generate-from-document', { document_id: id, deck_id: deckId, topic, count })
    toast('Not implemented yet. Backend is working on it!', 'error')
    setGenerating(false)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center text-gray-400 animate-pulse">
        Đang tải...
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h2 className="text-xl text-gray-300">Không tìm thấy tài liệu</h2>
        <Link to="/documents" className="text-violet-400 hover:underline mt-4 inline-block">Quay lại danh sách</Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-8">
      {/* Header */}
      <div>
        <Link to="/documents" className="text-sm font-medium text-gray-400 hover:text-white flex items-center gap-1 mb-4 w-fit transition-colors">
          ← Quay Thư viện
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center text-3xl border border-violet-500/20">
              📄
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-100 mb-1">{doc.filename}</h1>
              <div className="flex items-center gap-3 text-sm">
                <span className={`px-2 py-0.5 rounded-md font-medium ${
                  doc.status === 'ready' ? 'bg-emerald-400/10 text-emerald-400' :
                  doc.status === 'processing' ? 'bg-amber-400/10 text-amber-400' :
                  'bg-red-400/10 text-red-400'
                }`}>
                  {doc.status === 'ready' ? 'Sẵn sàng' : doc.status === 'processing' ? 'Đang xử lý' : 'Lỗi'}
                </span>
                <span className="text-gray-400">📑 {doc.page_count || 0} trang</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Generate Cards Form */}
        <div className="glass rounded-3xl p-6 border border-white/5">
          <div className="mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
              ✨ Auto-Gen Cards (RAG)
            </h2>
            <p className="text-sm text-gray-400">
              Tạo thẻ từ vựng tự động với context từ tài liệu này. 
            </p>
          </div>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Bộ thẻ đích</label>
              <select
                value={deckId}
                onChange={(e) => setDeckId(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                required
              >
                {decks.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Chủ đề (Topic) / Từ khóa</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="VD: Attention mechanism, Data structures..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-all placeholder:text-gray-600"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Số lượng thẻ</label>
              <input
                type="number"
                min="1"
                max="20"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={generating || doc.status !== 'ready'}
              className={`w-full py-3 rounded-xl font-bold text-white transition-all ${
                doc.status === 'ready' && !generating
                  ? 'bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 shadow-lg shadow-violet-500/25'
                  : 'bg-white/5 text-gray-500 cursor-not-allowed'
              }`}
            >
              {generating ? '⏳ Đang tạo...' : '🚀 Bắt đầu Tạo Thẻ'}
            </button>
            {doc.status !== 'ready' && (
              <p className="text-xs text-amber-500 text-center mt-2">
                Tài liệu cần phải ở trạng thái "Sẵn sàng" mới có thể Generate.
              </p>
            )}
          </form>
        </div>

        {/* Semantic Search box (Placeholder for next sub-phase) */}
        <div className="glass rounded-3xl p-6 border border-white/5 opacity-50 relative overflow-hidden group">
          <div className="absolute inset-0 bg-black/60 z-10 flex flex-col items-center justify-center">
            <span className="bg-white/10 px-3 py-1 text-sm rounded-full backdrop-blur font-medium mb-2">Comming Soon</span>
            <span className="text-gray-400 font-medium">Semantic Search</span>
          </div>
          <div className="mb-6 filter blur-[2px]">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
              🔍 Tìm kiếm ngữ nghĩa
            </h2>
            <p className="text-sm text-gray-400">
              Tìm các đoạn văn bản trong doc có chứa khái niệm liên quan.
            </p>
          </div>
          <div className="filter blur-[2px] space-y-4">
             <input disabled className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5" placeholder="Nhập câu truy vấn..." />
             <div className="h-24 bg-white/5 rounded-xl"></div>
          </div>
        </div>

      </div>
    </div>
  )
}
