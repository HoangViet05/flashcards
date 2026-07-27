import { useFeedback } from '../../../hooks/useFeedback'
import type { useDailySession } from '../../../hooks/useDailySession'
import FlipCard from '../../FlipCard'

interface Props {
  daily: ReturnType<typeof useDailySession>
}

/** Bước làm quen: chỉ lật thẻ và nghe, không chấm điểm nên luôn báo đúng. */
export default function FlipStep({ daily }: Props) {
  const fb = useFeedback()
  const queue = daily.queues.flip
  if (!queue.length) return null

  const word = queue[0]

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-3 text-sm font-medium text-muted">Turn the card and listen · {queue.length} remaining</p>
      {/* Bước này không chấm điểm nên không phát tiếng đúng/sai — chỉ một tiếng
          tách nhẹ để thao tác có phản hồi. */}
      <FlipCard
        key={word.card_id}
        card={word.card}
        isPractice
        onRate={() => undefined}
        onNext={() => { fb.saved(); daily.answer('flip', 'flip', true) }}
      />
    </div>
  )
}
