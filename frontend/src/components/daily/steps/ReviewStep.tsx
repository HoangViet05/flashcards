import type { useDailySession } from '../../../hooks/useDailySession'
import type { ExerciseStep } from '../../../types'
import ExerciseCard from '../ExerciseCard'

interface Props {
  daily: ReturnType<typeof useDailySession>
  onCorrectStreak?: (streak: number) => void
}

export default function ReviewStep({ daily, onCorrectStreak }: Props) {
  const queue = daily.queues.review

  if (!queue.length) {
    return (
      <div className="text-center">
        <p className="mb-4 text-sm font-bold text-correct">Xong phần ôn tập — tiếp theo là từ mới.</p>
        <button onClick={daily.beginNew} className="min-h-[44px] rounded-xl bg-accent px-6 text-sm font-bold text-white">
          Tiếp tục
        </button>
      </div>
    )
  }

  // Mỗi từ ôn tập chỉ làm đúng một dạng bài, đã chọn sẵn từ lúc tạo phiên.
  const word = queue[0]

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-3 text-sm font-medium text-muted">Ôn tập · còn {queue.length} từ</p>
      <ExerciseCard
        key={`${word.card_id}-${daily.presented}`}
        card={word.card}
        mode={word.assigned_step as ExerciseStep}
        onResult={correct => daily.answer('review', word.assigned_step, correct)}
        onCorrectStreak={onCorrectStreak}
      />
    </div>
  )
}
