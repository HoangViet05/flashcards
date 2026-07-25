import { Link } from 'react-router-dom'
import type { LatestArticle } from '../../types'

export default function HomeSideTiles({ article, workerOnline }: { article: LatestArticle | null; workerOnline: boolean | null }) {
  return <div className="mt-4 grid gap-3 sm:grid-cols-2">
    <Link to={article ? `/reader/${article.id}` : '/reader'} className="rounded-2xl border border-subtle bg-surface-1 p-4 transition hover:bg-surface-2"><p className="text-xs font-black uppercase tracking-wider text-muted">Đang đọc</p><p className="mt-1 truncate text-sm font-bold text-strong-text">{article?.title ?? 'Chưa có bài đọc'}</p><p className="mt-0.5 text-xs font-medium text-muted">{article ? article.unlearned_saved_words > 0 ? `${article.unlearned_saved_words} từ đã lưu chưa học` : 'Đã học hết từ đã lưu — đọc tiếp để lưu thêm' : 'Chọn một bài để bắt đầu lưu từ'}</p></Link>
    {workerOnline ? <Link to="/shadowing" className="rounded-2xl border border-subtle bg-surface-1 p-4 transition hover:bg-surface-2"><p className="text-xs font-black uppercase tracking-wider text-muted">Luyện nói</p><p className="mt-1 text-sm font-bold text-strong-text">Máy chấm đang bật</p><p className="mt-0.5 text-xs font-medium text-muted">Nghe câu, nói lại và được chấm điểm từng từ</p></Link> : <div aria-disabled="true" className="rounded-2xl border border-subtle bg-surface-1 p-4 opacity-60"><p className="text-xs font-black uppercase tracking-wider text-muted">Luyện nói</p><p className="mt-1 text-sm font-bold text-body">{workerOnline === null ? 'Đang kiểm tra máy chấm…' : 'Máy chấm đang tắt'}</p><p className="mt-0.5 text-xs font-medium text-muted">Bật máy host để chấm điểm phát âm</p></div>}
  </div>
}
