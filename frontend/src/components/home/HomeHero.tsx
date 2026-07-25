import { Link } from 'react-router-dom'

import type { DailyHome } from '../../types'
import ProgressRing from '../ProgressRing'

const CTA_LABEL: Record<DailyHome['session_status'], string> = {
  none: 'Bắt đầu buổi học',
  learning: 'Học tiếp',
  game: 'Vào phần chơi',
  done: 'Đã xong hôm nay',
}

/** Ước lượng thô: từ mới ~60 giây, từ ôn ~20 giây, làm tròn lên bội số của 5 phút. */
export function estimateMinutes(newCount: number, dueCount: number) {
  const seconds = newCount * 60 + dueCount * 20
  return Math.max(5, Math.ceil(seconds / 60 / 5) * 5)
}

export default function HomeHero({ home }: { home: DailyHome }) {
  const total = home.new_count + home.due_count
  const done = home.session_status === 'done'
  const percent = home.steps_total ? Math.round((home.steps_done / home.steps_total) * 100) : 0

  return (
    <section className="rounded-[1.5rem] border border-subtle bg-surface-1 p-5 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <ProgressRing percent={done ? 100 : percent} label={`${done ? 100 : percent}%`} sub="hôm nay" />

        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black tracking-tight text-strong-text sm:text-2xl">
            {done ? 'Hôm nay bạn đã học xong' : `Hôm nay có ${total} từ chờ bạn`}
          </h1>

          <p className="mt-1.5 text-sm font-medium text-muted">
            {home.new_count} từ mới · {home.due_count} từ ôn · ~{estimateMinutes(home.new_count, home.due_count)} phút
            {home.streak > 0 && ` · chuỗi ${home.streak} ngày`}
          </p>

          <Link
            to="/daily"
            aria-disabled={done}
            className={`mt-4 inline-flex min-h-[44px] items-center rounded-xl px-6 text-sm font-bold transition ${
              done
                ? 'pointer-events-none border border-subtle bg-surface-2 text-muted'
                : 'bg-accent text-white hover:brightness-110'
            }`}
          >
            {CTA_LABEL[home.session_status]}
          </Link>
        </div>
      </div>
    </section>
  )
}
