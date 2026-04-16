import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getDocuments, uploadDocument, deleteDocument } from '../api/documents'
import { Document } from '../types'
import { useNotification } from '../components/NotificationProvider'

export default function DocumentListPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast, confirm } = useNotification()

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const data = await getDocuments()
      setDocuments(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const uploadFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast('Vui lòng chọn file PDF', 'error')
      return
    }

    try {
      setUploading(true)
      await uploadDocument(file)
      toast('Tải lên thành công!', 'success')
      fetchDocuments()
    } catch (e) {
      console.error(e)
      toast('Có lỗi xảy ra khi tải lên', 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await uploadFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await uploadFile(file)
  }

  const handleDelete = (id: string) => {
    confirm({
      title: 'Xóa tài liệu',
      message: 'Bạn có chắc muốn xóa tài liệu này? Mọi thẻ tạo từ đây sẽ KHÔNG bị xóa.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteDocument(id)
          toast('Đã xóa tài liệu', 'success')
          fetchDocuments()
        } catch (e) {
          toast('Có lỗi khi xóa', 'error')
        }
      }
    })
  }

  return (
    <div 
      className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 min-h-[80vh]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[100] bg-violet-600/20 backdrop-blur-sm border-4 border-dashed border-violet-500 flex items-center justify-center pointer-events-none transition-all">
          <div className="bg-black/80 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 animate-bounce">
            <div className="text-6xl text-violet-400">📥</div>
            <p className="text-2xl font-bold text-white">Thả file PDF để tải lên</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400 mb-2">
            Thư viện Tài Liệu 📚
          </h1>
          <p className="text-gray-400 text-sm sm:text-base">
            Tải lên PDF khoa học hoặc kéo thả trực tiếp vào trang.
          </p>
        </div>
        
        <div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="application/pdf" 
            className="hidden" 
          />
          <button 
            onClick={handleUploadClick}
            disabled={uploading}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-violet-500/25 transition-all hover:scale-105 active:scale-95"
          >
            {uploading ? '⏳ Đang tải lên...' : '📄 + Tải lên PDF'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500 font-medium animate-pulse">
          Đang tải danh sách tài liệu...
        </div>
      ) : documents.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center border border-white/5 flex flex-col items-center justify-center gap-4">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-4xl mb-2">
            📭
          </div>
          <h3 className="text-xl font-bold text-gray-200">Chưa có tài liệu nào</h3>
          <p className="text-gray-500">Tải lên PDF đầu tiên để bắt đầu tạo thẻ từ vựng với RAG.</p>
          <button 
            onClick={handleUploadClick}
            className="mt-4 px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition-colors"
          >
            Upload PDF
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc) => (
            <div key={doc.id} className="glass group relative p-6 rounded-3xl backdrop-blur-xl bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 hover:border-violet-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(139,92,246,0.15)] flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-2xl text-2xl border border-violet-500/20">
                  📄
                </div>
                <button 
                  onClick={(e) => { e.preventDefault(); handleDelete(doc.id); }}
                  className="w-8 h-8 rounded-full bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors border border-transparent hover:border-red-500/20"
                >
                  🗑️
                </button>
              </div>
              
              <h3 className="text-lg font-bold text-gray-100 mb-1 line-clamp-2 truncate" title={doc.filename}>{doc.filename}</h3>
              <p className="text-sm text-gray-400 mb-4 flex items-center gap-2">
                {doc.page_count ? `📑 ${doc.page_count} trang` : '⏳ Đang đếm trang'}
                <span>•</span>
                {new Date(doc.created_at).toLocaleDateString()}
              </p>

              <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {doc.status === 'ready' && <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Sẵn sàng</span>}
                  {doc.status === 'processing' && <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md font-medium"><span className="w-3 h-3 text-[10px]">⏳</span> Đang xử lý</span>}
                  {doc.status === 'error' && <span className="flex items-center gap-1 text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded-md font-medium">Lỗi</span>}
                </div>
                <Link to={`/documents/${doc.id}`} className="text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors">
                  Chi tiết →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
