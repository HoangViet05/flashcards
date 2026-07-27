import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDailyHome } from '../../api/daily'
import { useFeedback } from '../../hooks/useFeedback'
import type { useDailySession } from '../../hooks/useDailySession'
import type { DailyHome, DailyWord } from '../../types'
interface Props { daily: ReturnType<typeof useDailySession>; onContinue: () => void }
const accuracy = (words: DailyWord[]) => { const attempts = words.reduce((sum, word) => sum + word.steps_done.length + word.wrong_count, 0); return attempts ? Math.round(words.reduce((sum, word) => sum + word.steps_done.length, 0) * 100 / attempts) : 100 }
export default function DailySummary({ daily, onContinue }: Props) { const [home, setHome] = useState<DailyHome | null>(null); const fb = useFeedback(); const panelRef = useRef<HTMLElement>(null); const words = daily.session?.words ?? []; const minutes = Math.max(1, Math.round((Date.now() - daily.startedAt) / 60000)); useEffect(() => { getDailyHome().then(setHome).catch(() => setHome(null)) }, []);
  // Chỉ bắn một lần khi màn tổng kết xuất hiện, không bắn lại khi home về.
  useEffect(() => { fb.sessionComplete(0, accuracy(words), panelRef.current) }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <section ref={panelRef} className="daily-summary glass-panel"><p className="eyebrow">Session complete</p><h2>Good work. Your next recall is already scheduled.</h2><p>{home ? `${home.mastered_cards} words are now in long-term review.` : 'Updating your learning progress…'}</p><dl>{[['Words', String(words.length)], ['Accuracy', `${accuracy(words)}%`], ['Time', `${minutes} min`], ['Streak', home ? `${home.streak} days` : '…']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="hero-actions"><button className="button-primary" onClick={onContinue}>Play the recall game</button><Link className="button-secondary" to="/">Return to Today</Link></div></section> }
