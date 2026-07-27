import { getDayDetail } from '../../api/progress'
import { useCachedQuery } from '../../hooks/useCachedQuery'
import { LoadingRegion } from '../shell/Skeleton'
import './Stats.css'

const SKILL_LABELS: Record<string, string> = {
  vocabulary: 'Từ vựng', reading: 'Đọc', listening: 'Nghe', speaking: 'Nói',
}

export default function DayDetailPanel({ date }: { date: string }) {
  const query = useCachedQuery(`progress-day:${date}`, () => getDayDetail(date))

  if (!query.data) {
    return <div className="stats-day glass-panel"><LoadingRegion label={`Đang tải chi tiết ngày ${date}`} lines={4} /></div>
  }

  const detail = query.data
  return (
    <div className="stats-day glass-panel">
      <div className="section-heading"><h2>{detail.date}</h2><span>{Math.round(detail.seconds / 60)} phút</span></div>
      <dl className="stats-day__facts">
        <div><dt>Lượt ôn</dt><dd>{detail.reviews}</dd></div>
        <div><dt>Từ mới</dt><dd>{detail.new_words}</dd></div>
      </dl>
      {detail.skills.length
        ? <ul className="stats-day__skills">
            {detail.skills.map(skill => (
              <li key={skill.skill}>{SKILL_LABELS[skill.skill] ?? skill.skill}<span>{Math.round(skill.seconds / 60)} phút</span></li>
            ))}
          </ul>
        : <p>Ngày này bạn nghỉ.</p>}
      {detail.articles.length
        ? <ul className="stats-day__articles">{detail.articles.map(article => <li key={article.id}>{article.title}</li>)}</ul>
        : null}
    </div>
  )
}
