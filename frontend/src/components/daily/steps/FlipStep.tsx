import type { useDailySession } from '../../../hooks/useDailySession'
import FlipCard from '../../FlipCard'

interface Props {
  daily: ReturnType<typeof useDailySession>
}

/** Bước làm quen: chỉ lật thẻ và nghe, không chấm điểm nên luôn báo đúng. */
export default function FlipStep({ daily }: Props) {
  const queue = daily.queues.flip
  if (!queue.length) return null

  const word = queue[0]

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-3 text-sm font-medium text-muted">Lật thẻ &amp; nghe · còn {queue.length} từ</p>
      <FlipCard
        key={word.card_id}
        card={word.card}
        isPractice
        onRate={() => undefined}
        onNext={() => daily.answer('flip', 'flip', true)}
      />
    </div>
  )
}
