import type { useDailySession } from '../../../hooks/useDailySession'
import type { ExerciseStep } from '../../../types'
import ExerciseCard from '../ExerciseCard'

interface Props {
  daily: ReturnType<typeof useDailySession>
  onCorrectStreak?: (streak: number) => void
}

/** Từ hay sai được kéo lên trước phần từ mới và hỏi bằng dạng khác lần trước. */
export default function WeakStep({ daily, onCorrectStreak }: Props) {
  const queue = daily.queues.weak

  if (!queue.length) {
    return (
      <div className="text-center">
        <p className="mb-4 text-sm font-bold text-correct">Weak-word practice is complete — new material is next.</p>
        <button onClick={daily.beginNew} className="min-h-[44px] rounded-xl bg-accent px-6 text-sm font-bold text-white">
          Continue
        </button>
      </div>
    )
  }

  const word = queue[0]
  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-3 text-sm font-medium text-warn">
        Weak words · {queue.length} remaining · use a different prompt from last time
      </p>
      <ExerciseCard
        key={`${word.card_id}-${daily.presented}`}
        card={word.card}
        mode={word.assigned_step as ExerciseStep}
        onResult={correct => daily.answer('weak', word.assigned_step, correct)}
        onCorrectStreak={onCorrectStreak}
      />
    </div>
  )
}
