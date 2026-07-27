import type { ProgressOverview } from '../../types'
import './Stats.css'

/** Dải phụ cuối trang. Kho thẻ và retention vẫn hữu ích khi cần tra, nhưng
 *  không thuộc ba câu hỏi mà dashboard này được dựng để trả lời. */
export default function LibraryStrip({ overview }: { overview: ProgressOverview }) {
  const items: Array<{ label: string; value: string | number }> = [
    { label: 'Đang học', value: overview.learning_cards },
    { label: 'Đã nhớ', value: overview.remembered_cards },
    { label: 'Đến hạn', value: overview.due_cards },
    { label: 'Tổng thẻ', value: overview.total_cards },
    { label: 'Retention', value: overview.retention === null ? '—' : `${overview.retention}%` },
  ]
  return (
    <section className="stats-library">
      {items.map(item => <p key={item.label}><span>{item.label}</span><strong>{item.value}</strong></p>)}
    </section>
  )
}
