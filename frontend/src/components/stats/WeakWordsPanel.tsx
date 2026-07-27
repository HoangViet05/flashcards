import { Link } from 'react-router-dom'
import type { WeakWord } from '../../types'
import './Stats.css'

const LIMIT = 8

/** Vùng duy nhất trên dashboard có hành động. Bảng số không bấm được thì chỉ là
 *  báo cáo; ở đây người học thấy chỗ yếu rồi luyện ngay chính nhóm đó. */
export default function WeakWordsPanel({ words }: { words: WeakWord[] }) {
  const top = words.slice(0, LIMIT)

  if (!top.length) {
    return (
      <section className="stats-weak glass-panel enter">
        <div className="section-heading"><h2>Từ hay quên</h2></div>
        <p>Bạn chưa có từ nào hay quên. Học thêm vài buổi rồi quay lại đây.</p>
      </section>
    )
  }

  return (
    <section className="stats-weak glass-panel enter">
      <div className="section-heading"><h2>Từ hay quên</h2><span>{top.length} từ</span></div>
      <ol className="stats-weak__list stagger">
        {top.map(item => {
          const ratio = item.total_reviews ? item.recent_wrong / item.total_reviews : 0
          return (
            <li key={item.card.id}>
              <strong>{item.card.front_text}</strong>
              <i><b style={{ inlineSize: `${Math.round(ratio * 100)}%` }} /></i>
              <span>{item.recent_wrong}/{item.total_reviews} sai</span>
            </li>
          )
        })}
      </ol>
      <Link className="button-primary tap" to="/weak">Học ngay {top.length} từ này</Link>
    </section>
  )
}
