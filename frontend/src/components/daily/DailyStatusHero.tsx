import { Link } from 'react-router-dom'

type StatusKind = 'complete' | 'empty'

interface Props {
  kind: StatusKind
  primaryTo: string
  primaryLabel: string
  secondaryTo?: string
  secondaryLabel?: string
}

const content = {
  complete: {
    eyebrow: 'Daily quest complete',
    title: 'Bạn đã chinh phục hôm nay!',
    body: 'Mỗi lần ôn là một bước để từ vựng ở lại lâu hơn trong trí nhớ.',
    icon: '🏆',
    badge: 'Phiên học đã hoàn tất',
    milestone: ['Ôn tập', 'Luyện phản xạ', 'Củng cố ghi nhớ'],
  },
  empty: {
    eyebrow: 'A calm learning day',
    title: 'Hôm nay bạn đã hết bài rồi!',
    body: 'Không có từ mới hay thẻ đến hạn. Tạo thêm thẻ để chuẩn bị cho hành trình ngày mai.',
    icon: '🌙',
    badge: 'Danh sách hôm nay trống',
    milestone: ['Không có thẻ đến hạn', 'Nhịp học đang ổn định', 'Sẵn sàng cho ngày mới'],
  },
} as const

export default function DailyStatusHero({ kind, primaryTo, primaryLabel, secondaryTo, secondaryLabel }: Props) {
  const item = content[kind]
  return <section className={`daily-status-hero daily-status-${kind}`}>
    <div className="daily-status-sky" aria-hidden="true"><i /><i /><i /><i /><i /><i /><span className="daily-status-comet" /></div>
    <div className="daily-status-card relative z-10 mx-auto max-w-3xl px-5 py-10 text-center sm:px-10 sm:py-14">
      <div className="daily-status-medal" aria-hidden="true"><span>{item.icon}</span></div>
      <p className="mt-6 text-[10px] font-black uppercase tracking-[.22em] text-cyan-200/80">{item.eyebrow}</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{item.title}</h1>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-300">{item.body}</p>
      <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/[.08] px-3 py-1.5 text-xs font-bold text-emerald-100"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.95)]" />{item.badge}</div>
      <div className="mx-auto mt-8 grid max-w-2xl gap-2 sm:grid-cols-3">{item.milestone.map((label, index) => <div key={label} className="daily-status-milestone"><span>{index + 1}</span><p>{label}</p><i aria-hidden="true">✓</i></div>)}</div>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link to={primaryTo} className="daily-status-primary">{primaryLabel} <span>→</span></Link>{secondaryTo && secondaryLabel && <Link to={secondaryTo} className="daily-status-secondary">{secondaryLabel}</Link>}</div>
    </div>
  </section>
}
