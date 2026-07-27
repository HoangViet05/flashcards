import { useRef, useState } from 'react'
import { importApkg, type AnkiImportResult } from '../api/anki'

interface Props {
  open: boolean
  onClose: () => void
  onImported: () => void
}

export default function ImportAnkiModal({ open, onClose, onImported }: Props) {
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState<AnkiImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.apkg')) {
      setError('Vui lòng chọn file .apkg xuất từ Anki.')
      return
    }
    setBusy(true); setUploadProgress(0); setError(null); setResult(null)
    try {
      const res = await importApkg(file, event => {
        if (event.total) setUploadProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
      })
      setResult(res)
      onImported()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Không thể nhập bộ thẻ. Vui lòng thử lại.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const close = () => { setResult(null); setError(null); setUploadProgress(0); onClose() }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={busy ? undefined : close} />
      <div className="glass rounded-[2rem] p-8 w-full max-w-lg animate-fade-in-up relative overflow-hidden bg-[#0a0a0f] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-[60px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
        <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-3 relative z-10">
          <span className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-lg">📥</span>
          Nhập dữ liệu từ Anki
        </h3>
        <p className="text-gray-400 text-sm mb-6 relative z-10">
          Tải bộ thẻ (.apkg) từ <span className="text-cyan-300">ankiweb.net/shared</span> rồi thả vào đây. Dữ liệu này sẽ được dùng tự động khi bạn lưu từ trong bài đọc, bao gồm cả âm thanh, hình ảnh và ví dụ.
        </p>

        {busy ? (
          <div className="py-8 relative z-10">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-semibold text-cyan-100">1. Tải file .apkg lên</span>
              <span className="font-bold text-cyan-300">{uploadProgress}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-400 transition-[width] duration-[var(--dur-base)]"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>

            <div className={`mt-5 flex items-center gap-3 ${uploadProgress < 100 ? 'text-gray-500' : 'text-cyan-100'}`}>
              {uploadProgress < 100 ? (
                <span className="w-5 h-5 rounded-full border-2 border-current/40" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-[11px] text-emerald-300">✓</span>
              )}
              <span className="text-sm font-medium">2. Đọc và phân tích các thẻ Anki</span>
            </div>
            <div className={`mt-4 flex items-center gap-3 ${uploadProgress < 100 ? 'text-gray-500' : 'text-cyan-200'}`}>
              {uploadProgress < 100 ? (
                <span className="w-5 h-5 rounded-full border-2 border-current/40" />
              ) : (
                <span className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-300 rounded-full animate-spin" />
              )}
              <span className="text-sm font-medium">3. Lưu từ vựng và dữ liệu đa phương tiện vào thư viện</span>
            </div>
            <p className="text-gray-400 text-sm mt-6">{uploadProgress < 100 ? 'Đang tải file lên…' : 'Đang xử lý trên máy chủ… file lớn có thể mất một phút.'}</p>
          </div>
        ) : result ? (
          <div className="relative z-10 flex flex-col gap-3">
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-5 text-emerald-200">
              <p className="font-bold text-lg mb-2">✅ Nhập xong!</p>
              <ul className="text-sm space-y-1">
                <li>Dữ liệu từ đã nhập: <b>{result.entries_imported}</b>{result.entries_skipped > 0 && ` (bỏ qua ${result.entries_skipped} đã có)`}</li>
              </ul>
              {result.warnings.length > 0 && (
                <ul className="text-xs text-amber-300 mt-3 space-y-0.5">
                  {result.warnings.map((w, i) => <li key={i}>⚠️ {w}</li>)}
                </ul>
              )}
            </div>
            <button onClick={close} className="btn-primary px-6 py-3 rounded-2xl font-bold self-end">Xong</button>
          </div>
        ) : (
          <div
            className={`relative z-10 rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
              dragging ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/15 hover:border-cyan-500/50 hover:bg-white/[0.03]'
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={e => { e.preventDefault(); setDragging(false) }}
            onDrop={e => {
              e.preventDefault(); setDragging(false)
              const f = e.dataTransfer.files?.[0]
              if (f) handleFile(f)
            }}
          >
            <p className="text-4xl mb-3">🗃️</p>
            <p className="text-white font-bold">Kéo thả file .apkg vào đây</p>
            <p className="text-gray-500 text-sm mt-1">hoặc bấm để chọn file</p>
            <input ref={fileRef} type="file" accept=".apkg" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </div>
        )}

        {error && <p className="text-red-300 text-sm mt-4 relative z-10">❌ {error}</p>}
      </div>
    </div>
  )
}
