import { useMemo, useState } from 'react'

interface Selection { start_row: number; start_col: number; end_row: number; end_col: number }
interface Props { grid: string[][]; foundCells: string[]; onSelect: (selection: Selection) => void }

function pathCells(sr: number, sc: number, er: number, ec: number): string[] | null {
  const dr = Math.sign(er - sr), dc = Math.sign(ec - sc)
  const straight = (dr === 0 && dc !== 0) || (dc === 0 && dr !== 0) || (Math.abs(er - sr) === Math.abs(ec - sc) && dr !== 0)
  if (!straight) return null
  return Array.from({ length: Math.max(Math.abs(er - sr), Math.abs(ec - sc)) + 1 }, (_, index) => `${sr + dr * index}-${sc + dc * index}`)
}

export default function WordSearchGrid({ grid, foundCells, onSelect }: Props) {
  const [start, setStart] = useState<[number, number] | null>(null); const [hover, setHover] = useState<[number, number] | null>(null)
  const found = useMemo(() => new Set(foundCells), [foundCells])
  const active = useMemo(() => new Set(start && hover ? pathCells(start[0], start[1], hover[0], hover[1]) ?? [] : []), [start, hover])
  const finish = () => { if (start && hover && pathCells(start[0], start[1], hover[0], hover[1])) onSelect({ start_row: start[0], start_col: start[1], end_row: hover[0], end_col: hover[1] }); setStart(null); setHover(null) }
  return <div className="inline-block touch-none select-none rounded-2xl border border-white/[.07] bg-white/[.03] p-3" onPointerUp={finish} onPointerLeave={() => { setStart(null); setHover(null) }}>
    {grid.map((row, r) => <div key={r} className="flex">{row.map((letter, c) => { const key = `${r}-${c}`; return <button key={key} onPointerDown={() => { setStart([r, c]); setHover([r, c]) }} onPointerEnter={() => start && setHover([r, c])} className={`m-0.5 flex h-8 w-8 items-center justify-center rounded-md text-sm font-black sm:h-9 sm:w-9 ${found.has(key) ? 'bg-emerald-400/30 text-emerald-200' : active.has(key) ? 'bg-cyan-400/40 text-white' : 'bg-black/25 text-slate-300 hover:bg-white/[.08]'}`}>{letter}</button> })}</div>)}
  </div>
}
