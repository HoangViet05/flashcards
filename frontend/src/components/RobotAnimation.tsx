import { useEffect, useRef, useState } from 'react'

type RobotAction = 'thinking' | 'add' | 'throw'

interface RobotAnimationProps {
  isVisible: boolean
  action: RobotAction
}

// Coin that pops up above the robot Mario-style
interface CoinProps {
  id: string
  onDone: () => void
}

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
        bottom: 'calc(12% + 90px)', // just above the robot emoji
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

  // Spawn a coin each time action becomes 'add'
  useEffect(() => {
    if (action === 'add' && mounted) {
      const id = Date.now().toString()
      setCoins(prev => [...prev, id])
    }
  }, [action, mounted])

  if (!mounted) return null

  const isAdd   = action === 'add'
  const isThrow = action === 'throw'
  const isThinking = action === 'thinking'

  const config = isThrow
    ? { emoji: '🗑️', label: 'Từ trùng!',       color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)' }
    : isAdd
    ? { emoji: '🤖', label: 'Thêm thẻ mới!',   color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.35)' }
    : { emoji: '🤖', label: 'Đang tạo thẻ...', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.25)' }

  return (
    <>
      {/* Coins popping above robot */}
      {coins.map(id => (
        <MarioCoin
          key={id}
          id={id}
          onDone={() => setCoins(prev => prev.filter(c => c !== id))}
        />
      ))}

      {/* Robot */}
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
          animation: exiting ? 'aiExit 0.4s ease forwards' : 'aiEnter 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
          willChange: 'transform, opacity',
        }}
        aria-hidden="true"
      >
        {/* Pill label */}
        <div style={{
          padding: '5px 14px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: 700,
          color: config.color,
          background: config.bg,
          border: `1.5px solid ${config.border}`,
          backdropFilter: 'blur(8px)',
          whiteSpace: 'nowrap',
        }}>
          {config.label}
        </div>

        {/* Robot emoji — shake on throw, bump on add */}
        <div style={{
          fontSize: '56px',
          lineHeight: 1,
          animation: isThinking
            ? 'aiFloat 2.4s ease-in-out infinite'
            : isThrow
            ? 'aiShake 0.5s ease both'
            : 'aiBump 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
          willChange: 'transform',
        }}>
          {config.emoji}
        </div>

        {/* Thinking dots */}
        {isThinking && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: '7px', height: '7px',
                borderRadius: '50%',
                background: config.color,
                opacity: 0.7,
                animation: `aiDot 1.2s ease-in-out infinite ${i * 0.2}s`,
                willChange: 'transform, opacity',
              }} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
