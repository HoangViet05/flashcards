import { useMemo } from 'react'
import type { HeatmapDay } from '../types'

const CELL = 12, GAP = 3
const LEVELS = ['#1e293b', '#164e63', '#0e7490', '#06b6d4', '#67e8f9']
const MONTHS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12']
const level = (count: number) => count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 9 ? 3 : 4

export default function StudyHeatmap({ data }: { data: HeatmapDay[] }) {
  const { weeks, ticks, total } = useMemo(() => {
    const counts = new Map(data.map(day => [day.date, day.count])); const today = new Date(); const start = new Date(today); start.setDate(start.getDate() - 364); start.setDate(start.getDate() - start.getDay())
    const weeks: { date: string; count: number; visible: boolean }[][] = []; const ticks: { index: number; label: string }[] = []; let cursor = start; let lastMonth = -1
    while (cursor <= today) { const week = []; for (let day = 0; day < 7; day += 1) { const date = cursor.toISOString().slice(0, 10); week.push({ date, count: counts.get(date) ?? 0, visible: cursor <= today }); if (cursor.getDate() <= 7 && cursor.getDay() === 0 && cursor.getMonth() !== lastMonth) { lastMonth = cursor.getMonth(); ticks.push({ index: weeks.length, label: MONTHS[lastMonth] }) }; cursor = new Date(cursor); cursor.setDate(cursor.getDate() + 1) }; weeks.push(week) }
    return { weeks, ticks, total: data.reduce((sum, day) => sum + day.count, 0) }
  }, [data])
  return <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-4"><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-black uppercase text-slate-400">🗓 Lịch sử học 12 tháng</h3><span className="text-xs text-slate-500">{total} lượt ôn</span></div><div className="overflow-x-auto pb-1"><svg width={weeks.length * (CELL + GAP)} height={7 * (CELL + GAP) + 16}>{ticks.map(tick => <text key={tick.index} x={tick.index * (CELL + GAP)} y={10} className="fill-slate-500" fontSize={9}>{tick.label}</text>)}{weeks.map((week, weekIndex) => week.map((day, dayIndex) => day.visible && <rect key={day.date} x={weekIndex * (CELL + GAP)} y={16 + dayIndex * (CELL + GAP)} width={CELL} height={CELL} rx={2.5} fill={LEVELS[level(day.count)]}><title>{`${day.date}: ${day.count} lượt ôn`}</title></rect>))}</svg></div><div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-500">Ít {LEVELS.map(color => <span key={color} className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />)} Nhiều</div></div>
}
