import type { QueueName, useDailySession } from '../../../hooks/useDailySession'
import type { ExerciseStep } from '../../../types'
import ExerciseCard from '../ExerciseCard'

interface Props {
  daily: ReturnType<typeof useDailySession>
  onCorrectStreak?: (streak: number) => void
}

const SIDES: { name: QueueName; step: ExerciseStep; label: string }[] = [
  { name: 'left', step: 'vi_en', label: 'Việt → Anh' },
  { name: 'right', step: 'en_vi', label: 'Anh → Việt' },
]

/** Hai panel cạnh nhau trên màn rộng. Dưới `md` chỉ hiện một panel: bên trái
 *  làm trước, xong mới đến bên phải — tránh phải cuộn qua lại khi học trên điện thoại. */
export default function SplitStep({ daily, onCorrectStreak }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {SIDES.map(({ name, step, label }) => {
        const queue = daily.queues[name]
        const hiddenOnMobile = !queue.length || (name === 'right' && daily.queues.left.length > 0)

        return (
          <div key={name} className={`${hiddenOnMobile ? 'hidden' : ''} md:block`}>
            <p className="mb-2 text-center text-xs font-black uppercase tracking-wider text-muted">
              {label} · còn {queue.length}
            </p>
            {queue.length ? (
              <ExerciseCard
                key={`${queue[0].card_id}-${daily.presented}`}
                card={queue[0].card}
                mode={step}
                onResult={correct => daily.answer(name, step, correct)}
                onCorrectStreak={onCorrectStreak}
              />
            ) : (
              <p className="text-center text-sm font-bold text-correct">Xong bên này</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
