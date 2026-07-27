import { Link } from 'react-router-dom'

import type { LatestArticle } from '../../types'

interface Props {
  article: LatestArticle | null
  /** `null` nghĩa là đang dò máy chấm, chưa biết bật hay tắt. */
  workerOnline: boolean | null
  weakCount: number
}

function readingHint(article: LatestArticle | null) {
  if (!article) return 'Chọn một bài để bắt đầu lưu từ'
  if (article.unlearned_saved_words > 0) return `${article.unlearned_saved_words} từ đã lưu chưa học`
  return 'Đã học hết từ đã lưu — đọc tiếp để lưu thêm'
}

export default function HomeSideTiles({ article, workerOnline, weakCount }: Props) {
  return (
    <div className="stagger mt-4 grid gap-3 sm:grid-cols-3">
      <Link
        to={article ? `/reader/${article.id}` : '/reader'}
        className="tap rounded-2xl border border-subtle bg-surface-1 p-4"
      >
        <p className="text-xs font-black uppercase tracking-wider text-muted">Đang đọc</p>
        <p className="mt-1 truncate text-sm font-bold text-strong-text">{article?.title ?? 'Chưa có bài đọc'}</p>
        <p className="mt-0.5 text-xs font-medium text-muted">{readingHint(article)}</p>
      </Link>

      {workerOnline ? (
        <Link to="/shadowing" className="tap rounded-2xl border border-subtle bg-surface-1 p-4">
          <p className="text-xs font-black uppercase tracking-wider text-muted">Luyện nói</p>
          <p className="mt-1 text-sm font-bold text-strong-text">Máy chấm đang bật</p>
          <p className="mt-0.5 text-xs font-medium text-muted">Nghe câu, nói lại và được chấm điểm từng từ</p>
        </Link>
      ) : (
        // Máy chấm nằm ở máy host, thường xuyên tắt — nói thẳng thay vì để bấm vào rồi hụt.
        <div aria-disabled="true" className="rounded-2xl border border-subtle bg-surface-1 p-4 opacity-60">
          <p className="text-xs font-black uppercase tracking-wider text-muted">Luyện nói</p>
          <p className="mt-1 text-sm font-bold text-body">
            {workerOnline === null ? 'Đang kiểm tra máy chấm…' : 'Máy chấm đang tắt'}
          </p>
          <p className="mt-0.5 text-xs font-medium text-muted">Bật máy host để chấm điểm phát âm</p>
        </div>
      )}

      {weakCount > 0 && (
        <Link to="/weak" className="tap rounded-2xl border border-warn/30 bg-warn/10 p-4">
          <p className="text-xs font-black uppercase tracking-wider text-warn">Từ đang yếu</p>
          <p className="mt-1 text-sm font-bold text-strong-text">{weakCount} từ hay sai</p>
          <p className="mt-0.5 text-xs font-medium text-muted">Luyện lại bằng dạng bài khác</p>
        </Link>
      )}
    </div>
  )
}
