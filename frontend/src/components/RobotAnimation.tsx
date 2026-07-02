import { useEffect, useRef, useState } from 'react'

type RobotAction = 'thinking' | 'add' | 'throw'

interface RobotAnimationProps {
  isVisible: boolean
  action: RobotAction
}

interface CoinProps {
  id: string
  onDone: () => void
}

// ── Mario coin pop (unchanged) ─────────────────────────────────────
function MarioCoin({ id, onDone }: CoinProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 900)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      key={id}
      style={{
        position: 'fixed',
        bottom: 'calc(12% + 90px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9998,
        pointerEvents: 'none',
        fontSize: '28px',
        lineHeight: 1,
        animation: 'coinPop 0.85s cubic-bezier(0.22,1,0.36,1) forwards',
        willChange: 'transform, opacity',
      }}
    >
      🪙
    </div>
  )
}

// ── GlyphViz — AI tokenizer scanning kanji (ported from tech.jsx) ──
function GlyphViz({ action }: { action: RobotAction }) {
  const isAdd = action === 'add'
  const isThrow = action === 'throw'

  // colour palette matching the existing project theme
  const color = isThrow ? '#f87171' : isAdd ? '#4ade80' : '#8beffaff'

  const glyphs = ['語', '言', '字', '義', '音', '意', '知', '学', '読', '書', '詩', '想']
  const decoded = ['language', 'word', 'sign', 'meaning', 'sound', 'intent', 'know', 'learn', 'read', 'write', 'verse', 'idea']

  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setCursor(c => (c + 1) % glyphs.length), 260)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        width: 320,
        height: 230,
        filter: `drop-shadow(0 0 18px ${color}66)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.65), rgba(0,0,0,0.35))',
          border: `1px solid ${color}66`,
          borderRadius: 10,
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        {/* ── LEFT: glyph grid being scanned ── */}
        <div style={{ flex: '0 0 60%', position: 'relative', padding: '26px 10px 20px' }}>
          {/* header label */}
          <div
            style={{
              position: 'absolute',
              top: 6, left: 10, right: 10,
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'monospace',
              fontSize: 9,
              color,
              letterSpacing: '0.15em',
            }}
          >
            <span>SCAN · CJK</span>
            <span style={{ opacity: 0.6 }}>
              seq {String(cursor + 1).padStart(2, '0')}/{glyphs.length}
            </span>
          </div>

          {/* glyph grid */}
          <div
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gridTemplateRows: 'repeat(3, 1fr)',
              gap: 8,
              height: '100%',
            }}
          >
            {glyphs.map((g, i) => {
              const isActive = i === cursor
              const wasRecent = (cursor - i + glyphs.length) % glyphs.length <= 2
              return (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'serif',
                    fontSize: 22,
                    fontWeight: 600,
                    color: isActive ? '#fff' : color,
                    textShadow: isActive
                      ? `0 0 12px #fff, 0 0 20px ${color}`
                      : wasRecent
                        ? `0 0 6px ${color}`
                        : 'none',
                    border: `1px solid ${isActive ? color : `${color}33`}`,
                    borderRadius: 6,
                    background: isActive
                      ? `${color}33`
                      : wasRecent
                        ? `${color}15`
                        : `${color}06`,
                    boxShadow: isActive
                      ? `inset 0 0 14px ${color}88, 0 0 12px ${color}66`
                      : 'none',
                    transform: isActive ? 'scale(1.04)' : 'scale(1)',
                    transition: 'all .2s ease',
                  }}
                >
                  {/* corner crosshair ticks */}
                  {isActive && (
                    <>
                      <span style={{ position: 'absolute', top: -1, left: -1, width: 6, height: 6, borderTop: `2px solid ${color}`, borderLeft: `2px solid ${color}` }} />
                      <span style={{ position: 'absolute', top: -1, right: -1, width: 6, height: 6, borderTop: `2px solid ${color}`, borderRight: `2px solid ${color}` }} />
                      <span style={{ position: 'absolute', bottom: -1, left: -1, width: 6, height: 6, borderBottom: `2px solid ${color}`, borderLeft: `2px solid ${color}` }} />
                      <span style={{ position: 'absolute', bottom: -1, right: -1, width: 6, height: 6, borderBottom: `2px solid ${color}`, borderRight: `2px solid ${color}` }} />
                    </>
                  )}
                  {g}
                  {/* tiny stroke-count badge */}
                  <span
                    style={{
                      position: 'absolute',
                      top: 2, right: 4,
                      fontFamily: 'monospace',
                      fontSize: 7,
                      color,
                      opacity: isActive ? 1 : 0.5,
                    }}
                  >
                    {String((i * 3 + 7) % 20).padStart(2, '0')}
                  </span>
                </div>
              )
            })}
          </div>

          {/* horizontal scan sweep line */}
          <div
            style={{
              position: 'absolute',
              left: 8, right: 8,
              height: 2,
              background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
              boxShadow: `0 0 14px ${color}`,
              animation: 'glyphScan 2.6s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* ── RIGHT: decode pipeline ── */}
        <div
          style={{
            flex: '1 1 auto',
            position: 'relative',
            borderLeft: `1px dashed ${color}44`,
            padding: '26px 10px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontFamily: 'monospace',
            fontSize: 10,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 6, left: 10, right: 10,
              fontSize: 9, color,
              letterSpacing: '0.15em',
            }}
          >
            DECODE ▒▓
          </div>

          {/* rolling pipeline rows */}
          {[0, 1, 2, 3, 4].map(offset => {
            const idx = (cursor - offset + glyphs.length) % glyphs.length
            const opacity = offset === 0 ? 1 : Math.max(0.15, 1 - offset * 0.22)
            return (
              <div
                key={offset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: offset === 0 ? '#fff' : color,
                  opacity,
                  animation: offset === 0 ? 'glyphLineIn .25s ease both' : 'none',
                  padding: '3px 6px',
                  background: offset === 0 ? `${color}22` : 'transparent',
                  borderLeft: offset === 0 ? `2px solid ${color}` : '2px solid transparent',
                  borderRadius: 3,
                }}
              >
                <span style={{ fontFamily: 'serif', fontSize: 15 }}>{glyphs[idx]}</span>
                <span style={{ opacity: 0.6 }}>→</span>
                <span style={{ letterSpacing: '0.05em' }}>{decoded[idx]}</span>
              </div>
            )
          })}

          {/* entropy / waveform bars */}
          <div
            style={{
              marginTop: 'auto',
              display: 'flex',
              alignItems: 'flex-end',
              gap: 2,
              height: 22,
              padding: '0 4px',
            }}
          >
            {Array.from({ length: 14 }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  background: `linear-gradient(180deg, ${color}, ${color}55)`,
                  borderRadius: 1,
                  animation: `waveBar ${0.5 + (i % 6) * 0.09}s ease-in-out infinite ${i * 0.04}s alternate`,
                  boxShadow: `0 0 4px ${color}88`,
                }}
              />
            ))}
          </div>

          {/* status row */}
          <div
            style={{
              fontSize: 9,
              color,
              letterSpacing: '0.1em',
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 4,
              paddingTop: 4,
              borderTop: `1px dashed ${color}33`,
            }}
          >
            <span>{isThrow ? '✕ DUP' : isAdd ? '+ OK' : '◉ PARSE'}</span>
            <span style={{ opacity: 0.65 }}>{isAdd ? '1/1' : '···'}</span>
          </div>
        </div>

        {/* ── central STAMP on add / throw ── */}
        {(isAdd || isThrow) && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              zIndex: 7,
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: '0.3em',
              color: '#fff',
              textShadow: `0 0 14px ${color}, 0 0 28px ${color}`,
              animation: 'matrixStamp .4s ease-out',
              pointerEvents: 'none',
            }}
          >
            {isThrow ? '✕ DUP' : '✓ ADDED'}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main exported component ────────────────────────────────────────
export default function RobotAnimation({ isVisible, action }: RobotAnimationProps) {
  const [mounted, setMounted] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [coins, setCoins] = useState<string[]>([])
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isVisible) {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
      setExiting(false)
      setMounted(true)
    } else {
      setExiting(true)
      exitTimerRef.current = setTimeout(() => {
        setMounted(false)
        setExiting(false)
      }, 500)
    }
    return () => { if (exitTimerRef.current) clearTimeout(exitTimerRef.current) }
  }, [isVisible])

  // Spawn coin on each 'add' event
  useEffect(() => {
    if (action === 'add' && mounted) {
      setCoins(prev => [...prev, Date.now().toString()])
    }
  }, [action, mounted])

  if (!mounted) return null

  const isThrow = action === 'throw'
  const isAdd = action === 'add'
  const isThinking = action === 'thinking'

  const labelColor = isThrow ? '#f87171' : isAdd ? '#4ade80' : '#8beffaff'
  const labelBg = isThrow ? 'rgba(248,113,113,0.12)' : isAdd ? 'rgba(74,222,128,0.12)' : 'rgba(167,139,250,0.10)'
  const labelBorder = isThrow ? 'rgba(248,113,113,0.35)' : isAdd ? 'rgba(74,222,128,0.35)' : 'rgba(167,139,250,0.30)'
  const labelText = isThrow ? 'Từ trùng!' : isAdd ? 'Thêm thẻ mới!' : 'Đang tạo thẻ...'

  return (
    <>
      {/* Coins */}
      {coins.map(id => (
        <MarioCoin
          key={id}
          id={id}
          onDone={() => setCoins(prev => prev.filter(c => c !== id))}
        />
      ))}

      {/* Main panel */}
      <div
        style={{
          position: 'fixed',
          bottom: '12%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 490,
          pointerEvents: 'none',
          userSelect: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          animation: exiting
            ? 'aiExit 0.4s ease forwards'
            : 'aiEnter 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
          willChange: 'transform, opacity',
        }}
        aria-hidden="true"
      >
        {/* Pill label */}
        <div
          style={{
            padding: '5px 14px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 700,
            color: labelColor,
            background: labelBg,
            border: `1.5px solid ${labelBorder}`,
            backdropFilter: 'blur(8px)',
            whiteSpace: 'nowrap',
          }}
        >
          {labelText}
        </div>

        {/* Glyph viz panel */}
        <GlyphViz action={action} />

        {/* Thinking dots */}
        {isThinking && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: labelColor,
                  opacity: 0.7,
                  animation: `aiDot 1.2s ease-in-out infinite ${i * 0.2}s`,
                  willChange: 'transform, opacity',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
