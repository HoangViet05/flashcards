import type { useDailySession } from '../../../hooks/useDailySession'
import ExerciseCard from '../ExerciseCard'

interface Props {
  daily: ReturnType<typeof useDailySession>
  onCorrectStreak?: (streak: number) => void
}

export default function DictationStep({ daily, onCorrectStreak }: Props) {
  const queue = daily.queues.dictation
  if (!queue.length) return null

  const word = queue[0]

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-3 text-sm font-medium text-muted">Listen and type · {queue.length} remaining</p>
      <ExerciseCard
        key={`${word.card_id}-${daily.presented}`}
        card={word.card}
        mode="dictation"
        onResult={correct => daily.answer('dictation', 'dictation', correct)}
        onCorrectStreak={onCorrectStreak}
      />
    </div>
  )
}
