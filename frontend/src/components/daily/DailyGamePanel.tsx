import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { confirmGame, getDailyGame, postGameFound, postGameHint } from '../../api/daily'
import { useNotification } from '../NotificationProvider'
import type { DailyGame, GameChip, GameConfirmResult } from '../../types'
import WordSearchGrid from './WordSearchGrid'
import DailyStatusHero from './DailyStatusHero'

type Wire = { id: string; path: string; startX: number; startY: number; endX: number; endY: number }
type MusicMode = 'arcade' | 'chase' | 'epic'

const MUSIC_TRACKS: Record<MusicMode, { label: string; notes: number[]; tempo: number; wave: OscillatorType }> = {
  arcade: { label: 'Arcade', notes: [261.63, 329.63, 392, 523.25, 493.88, 392, 329.63, 293.66], tempo: 310, wave: 'square' },
  chase: { label: 'Rượt đuổi', notes: [110, 130.81, 164.81, 196, 164.81, 220, 196, 164.81], tempo: 230, wave: 'sawtooth' },
  epic: { label: 'Cao trào', notes: [130.81, 164.81, 196, 261.63, 220, 196, 164.81, 196], tempo: 390, wave: 'triangle' },
}

function wirePath(startX: number, startY: number, endX: number, endY: number) {
  const curve = Math.max(44, (endX - startX) * 0.4)
  return `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`
}

function GameMusicToggle() {
  const [playing, setPlaying] = useState(false)
  const [mode, setMode] = useState<MusicMode>('chase')
  const contextRef = useRef<AudioContext | null>(null)
  const loopRef = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (loopRef.current !== null) window.clearInterval(loopRef.current)
    loopRef.current = null
    const context = contextRef.current
    contextRef.current = null
    if (context && context.state !== 'closed') void context.close()
    setPlaying(false)
  }, [])

  const start = useCallback(async (nextMode: MusicMode) => {
    const track = MUSIC_TRACKS[nextMode]
    const context = new AudioContext()
    contextRef.current = context
    await context.resume()
    const playNote = (frequency: number, volume: number, duration: number, wave = track.wave) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const now = context.currentTime
      oscillator.type = wave
      oscillator.frequency.setValueAtTime(frequency, now)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.045)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + duration + 0.03)
    }
    const playDrum = (strength: number) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const now = context.currentTime
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(120, now)
      oscillator.frequency.exponentialRampToValueAtTime(45, now + 0.13)
      gain.gain.setValueAtTime(strength, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.18)
    }
    let step = 0
    const play = () => {
      const note = track.notes[step % track.notes.length]
      playNote(note, nextMode === 'chase' ? 0.022 : 0.027, nextMode === 'chase' ? 0.28 : 0.46)
      if (step % 2 === 0) playNote(note / 2, 0.015, 0.45, 'sine')
      if (nextMode !== 'arcade' || step % 2 === 0) playDrum(step % 4 === 0 ? 0.08 : 0.038)
      if (nextMode === 'epic' && step % 4 === 2) playNote(note * 1.5, 0.014, 0.35, 'sine')
      step += 1
    }
    play()
    loopRef.current = window.setInterval(play, track.tempo)
    setPlaying(true)
  }, [])

  useEffect(() => () => stop(), [stop])

  const changeMode = (nextMode: MusicMode) => {
    setMode(nextMode)
    if (playing) { stop(); window.setTimeout(() => void start(nextMode), 0) }
  }

  return <div className="game-audio-controls"><button onClick={() => { if (playing) stop(); else void start(mode) }} aria-pressed={playing} className={`game-music-toggle ${playing ? 'is-playing' : ''}`} title={playing ? 'Tắt nhạc nền' : 'Bật nhạc nền'}><span className="game-equalizer" aria-hidden="true"><i /><i /><i /></span><span>{playing ? 'Nhạc: bật' : 'Nhạc: tắt'}</span></button><div className="game-track-picker" role="group" aria-label="Chọn thể loại nhạc">{(Object.keys(MUSIC_TRACKS) as MusicMode[]).map(item => <button key={item} onClick={() => changeMode(item)} className={mode === item ? 'is-active' : ''}>{MUSIC_TRACKS[item].label}</button>)}</div></div>
}

function GameResults({ results }: { results: GameConfirmResult[] }) {
  const correct = results.filter(item => item.correct).length
  const perfect = correct === results.length
  const passed = correct >= Math.ceil(results.length * 0.6)
  const celebration = perfect || passed
  return <div className={`game-result-screen ${celebration ? 'is-success' : 'is-failure'}`}><div className="game-result-particles" aria-hidden="true">{Array.from({ length: celebration ? 28 : 14 }, (_, index) => <i key={index} style={{ '--i': index } as CSSProperties} />)}</div><div className="relative z-10 mx-auto max-w-2xl rounded-[2rem] border p-6 text-center sm:p-8"><div className="game-result-icon" aria-hidden="true">{perfect ? '🏆' : celebration ? '✨' : '⚠️'}</div><p className="mt-4 text-[10px] font-black uppercase tracking-[.2em] text-slate-400">{perfect ? 'Perfect connection' : celebration ? 'Good run' : 'Needs another round'}</p><h2 className="mt-2 text-2xl font-black text-white">{perfect ? 'Kết nối hoàn hảo!' : celebration ? 'Bạn đã làm rất tốt!' : 'Chưa chính xác lần này'}</h2><p className="mt-2 text-sm text-slate-300">Bạn nối đúng <b className={celebration ? 'text-emerald-200' : 'text-rose-200'}>{correct}/{results.length}</b> cặp từ.</p><ul className="mt-6 space-y-2 text-left">{results.map(item => <li key={item.card_id} className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${item.correct ? 'border-emerald-300/20 bg-emerald-400/[.09] text-emerald-100' : 'border-rose-300/20 bg-rose-400/[.08] text-rose-100'}`}><b>{item.word}</b><span className="text-right">{item.meaning}</span><span>{item.correct ? '✓' : '×'}</span></li>)}</ul>{!celebration && <p className="mt-5 text-sm text-rose-200/90">Đừng nản nhé — lần sau hãy lần theo dây và kiểm tra kỹ nghĩa trước khi xác nhận.</p>}</div></div>
}

export default function DailyGamePanel({ onDone }: { onDone?: () => void }) {
  const { toast } = useNotification()
  const [game, setGame] = useState<DailyGame | null>(null)
  const [found, setFound] = useState<GameChip[]>([])
  const [links, setLinks] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [hints, setHints] = useState<Record<string, string>>({})
  const [results, setResults] = useState<GameConfirmResult[] | null>(null)
  const [error, setError] = useState<'learning' | 'missing' | null>(null)
  const [flyingChip, setFlyingChip] = useState<GameChip | null>(null)
  const [wires, setWires] = useState<Wire[]>([])
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 })
  const boardRef = useRef<HTMLDivElement>(null)
  const wordRefs = useRef(new Map<string, HTMLButtonElement>())
  const meaningRefs = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    getDailyGame()
      .then(value => { setGame(value); setFound(value.found) })
      .catch(err => setError(err?.response?.status === 409 ? 'learning' : 'missing'))
  }, [])

  const foundCells = useMemo(
    () => found.flatMap(chip => (chip.cells ?? []).map(([row, col]) => `${row}-${col}`)),
    [found],
  )

  const measureWires = useCallback(() => {
    const board = boardRef.current
    if (!board) return
    const boardRect = board.getBoundingClientRect()
    setBoardSize({ width: boardRect.width, height: boardRect.height })
    setWires(Object.entries(links).flatMap(([cardId, token]) => {
      const word = wordRefs.current.get(cardId)?.getBoundingClientRect()
      const meaning = meaningRefs.current.get(token)?.getBoundingClientRect()
      if (!word || !meaning) return []
      const startX = word.right - boardRect.left - 8
      const startY = word.top - boardRect.top + word.height / 2
      const endX = meaning.left - boardRect.left + 8
      const endY = meaning.top - boardRect.top + meaning.height / 2
      return [{ id: cardId, path: wirePath(startX, startY, endX, endY), startX, startY, endX, endY }]
    }))
  }, [links])

  useLayoutEffect(() => {
    measureWires()
    const board = boardRef.current
    if (!board) return
    const observer = new ResizeObserver(measureWires)
    observer.observe(board)
    window.addEventListener('resize', measureWires)
    return () => { observer.disconnect(); window.removeEventListener('resize', measureWires) }
  }, [found, measureWires])

  if (error === 'learning') return <DailyStatusHero kind="locked" primaryTo="/daily" primaryLabel="Tiếp tục học" secondaryTo="/" secondaryLabel="Về trang chủ" />
  if (error === 'missing') return <DailyStatusHero kind="start" primaryTo="/" primaryLabel="Tạo thẻ để bắt đầu" secondaryTo="/reader" secondaryLabel="Mở Tech Reader" />
  if (!game) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" /></div>
  if (results) return <GameResults results={results} />

  const allFound = found.length === game.total_words
  const allLinked = allFound && found.every(chip => chip.card_id in links)
  const linkedCardFor = (token: string) => Object.keys(links).find(cardId => links[cardId] === token)
  const link = (token: string) => {
    if (!selected) return
    setLinks(previous => {
      const next = { ...previous }
      for (const cardId of Object.keys(next)) if (next[cardId] === token) delete next[cardId]
      next[selected] = token
      return next
    })
    setSelected(null)
  }
  const findWord = (selection: { start_row: number; start_col: number; end_row: number; end_col: number }) => {
    void postGameFound(selection).then(match => {
      if (!match) return
      if (found.some(chip => chip.card_id === match.card_id)) return
      setFound(previous => [...previous, match])
      setFlyingChip(match)
      window.setTimeout(() => setFlyingChip(current => current?.card_id === match.card_id ? null : current), 900)
      toast(`🎉 Tìm thấy: ${match.word}`, 'success')
    }).catch(() => toast('Không kiểm tra được lựa chọn', 'error'))
  }

  return (
    <section className="game-stage relative isolate overflow-hidden rounded-[2rem] border border-white/[.07] bg-[#090a11]/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,.28)] sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"><span className="game-stage-orb game-stage-orb-one" /><span className="game-stage-orb game-stage-orb-two" /><span className="game-stage-star game-stage-star-one" /><span className="game-stage-star game-stage-star-two" /><span className="game-stage-star game-stage-star-three" /></div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-300">Word wire</p><h2 className="mt-1 text-xl font-black text-white">Tìm từ, rồi nối đúng nghĩa</h2><p className="mt-1 text-sm text-slate-400">Chữ cái tìm đúng sẽ bay thành thẻ tiếng Anh để bạn kéo dây ghép nghĩa.</p></div>
        <div className="flex items-center gap-2"><GameMusicToggle /><div className="rounded-full border border-cyan-300/20 bg-cyan-400/[.08] px-3 py-1.5 text-sm font-black text-cyan-100">{found.length}/{game.total_words} từ</div></div>
      </header>

      <div ref={boardRef} className="relative">
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 hidden h-full w-full xl:block" viewBox={`0 0 ${boardSize.width} ${boardSize.height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="word-wire" x1="0" x2="1"><stop stopColor="#22d3ee" /><stop offset="1" stopColor="#a78bfa" /></linearGradient>
            <filter id="wire-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          {wires.map(wire => <g key={wire.id} filter="url(#wire-glow)"><path d={wire.path} fill="none" stroke="url(#word-wire)" strokeWidth="2.5" strokeLinecap="round" /><circle cx={wire.startX} cy={wire.startY} r="4" fill="#67e8f9" /><circle cx={wire.endX} cy={wire.endY} r="4" fill="#c4b5fd" /></g>)}
        </svg>

        <div className="relative z-20 grid gap-5 xl:grid-cols-[minmax(34rem,1.1fr)_minmax(14rem,.55fr)_minmax(20rem,.9fr)] xl:items-start xl:gap-8">
          <section>
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">🔍 Tìm từ trong ô chữ</p>
            <WordSearchGrid grid={game.grid} foundCells={foundCells} arrivingCells={(flyingChip?.cells ?? []).map(([row, col]) => `${row}-${col}`)} onSelect={findWord} />
          </section>

          <section className="min-h-32">
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">✨ Từ vừa tìm</p>
            <div className="space-y-3">
              {!found.length && <div className="rounded-2xl border border-dashed border-white/10 bg-white/[.025] px-4 py-6 text-center text-sm text-slate-500">Tìm một từ để thẻ xuất hiện ở đây.</div>}
              {found.map(chip => {
                const linked = chip.card_id in links
                const isFlying = flyingChip?.card_id === chip.card_id
                return <button key={chip.card_id} ref={node => { if (node) wordRefs.current.set(chip.card_id, node); else wordRefs.current.delete(chip.card_id) }} onClick={() => setSelected(previous => previous === chip.card_id ? null : chip.card_id)} className={`word-wire-card relative w-full overflow-hidden rounded-2xl border px-4 py-3 text-left transition ${isFlying ? 'animate-word-card-assemble' : ''} ${selected === chip.card_id ? 'border-cyan-200 bg-cyan-400/20 text-white shadow-[0_0_28px_rgba(34,211,238,.24)]' : linked ? 'border-violet-300/40 bg-violet-400/[.12] text-violet-100' : 'border-white/10 bg-white/[.055] text-slate-100 hover:border-cyan-300/50 hover:bg-cyan-400/[.08]'}`}><span className="relative z-10 block font-black tracking-wide">{chip.word}</span><span className="relative z-10 mt-1 block text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">{selected === chip.card_id ? 'Chọn nghĩa bên phải' : linked ? 'Đã nối · chạm để đổi' : 'Chạm để nối'}</span><span className="absolute -right-5 -top-6 h-16 w-16 rounded-full bg-cyan-300/10 blur-xl" /></button>
              })}
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">🔗 Thẻ nghĩa tiếng Việt</p>
            <div className="space-y-3">
              {game.meanings.map(meaning => {
                const linkedCardId = linkedCardFor(meaning.token)
                const isTarget = Boolean(selected)
                return <div key={meaning.token} className="relative"><button ref={node => { if (node) meaningRefs.current.set(meaning.token, node); else meaningRefs.current.delete(meaning.token) }} disabled={!isTarget} onClick={() => link(meaning.token)} className={`w-full rounded-2xl border p-4 text-left transition ${linkedCardId ? 'border-violet-300/45 bg-violet-400/[.12]' : isTarget ? 'border-cyan-300/60 bg-cyan-400/[.1] shadow-[0_0_22px_rgba(34,211,238,.13)] hover:bg-cyan-400/[.18]' : 'border-white/[.09] bg-white/[.035]'} disabled:cursor-default`}><span className="block text-sm font-bold leading-5 text-slate-100">{meaning.meaning}</span><span className={`mt-2 block text-[10px] font-black uppercase tracking-[.14em] ${linkedCardId ? 'text-violet-200' : isTarget ? 'text-cyan-200' : 'text-slate-500'}`}>{linkedCardId ? 'Đã có dây kết nối' : isTarget ? 'Nhấn để nối thẻ đang chọn' : 'Chờ từ tiếng Anh'}</span></button>{!linkedCardId && <button onClick={() => void postGameHint(meaning.token).then(hint => setHints(old => ({ ...old, [meaning.token]: hint.text }))).catch(() => toast('Không lấy được gợi ý', 'error'))} className="mt-1.5 text-xs text-slate-500 transition hover:text-amber-300">💡 {hints[meaning.token] ?? 'Gợi ý'}</button>}</div>
              })}
            </div>
          </section>
        </div>
      </div>

      <footer className="mt-6 flex flex-col items-start justify-between gap-3 border-t border-white/[.06] pt-4 sm:flex-row sm:items-center"><p className="text-xs text-slate-500">{selected ? 'Chọn thẻ nghĩa tiếng Việt để tạo đường dây.' : allFound ? 'Nối các thẻ còn lại rồi xác nhận.' : 'Tìm hết từ trong ô chữ để mở khóa xác nhận.'}</p><button disabled={!allLinked} onClick={() => void confirmGame(Object.entries(links).map(([card_id, token]) => ({ card_id, token }))).then(value => { setResults(value); onDone?.() }).catch(() => toast('Không xác nhận được kết quả', 'error'))} className="w-full rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-5 py-3 text-sm font-black text-emerald-200 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">✅ Xác nhận kết quả</button></footer>
    </section>
  )
}
