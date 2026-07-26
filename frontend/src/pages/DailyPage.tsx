import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import DailyGamePanel from '../components/daily/DailyGamePanel'
import DailyProgress from '../components/daily/DailyProgress'
import DailyStatusHero from '../components/daily/DailyStatusHero'
import DailySummary from '../components/daily/DailySummary'
import DictationStep from '../components/daily/steps/DictationStep'
import FlipStep from '../components/daily/steps/FlipStep'
import ReviewStep from '../components/daily/steps/ReviewStep'
import SpeakStep from '../components/daily/steps/SpeakStep'
import SplitStep from '../components/daily/steps/SplitStep'
import WeakStep from '../components/daily/steps/WeakStep'
import { useDailySession } from '../hooks/useDailySession'
import AiOrb from '../components/orb/AiOrb'

export default function DailyPage() {
  const [params] = useSearchParams()
  const daily = useDailySession(params.get('mode') === 'quick' ? 'quick' : 'full')
  const [combo, setCombo] = useState(0)

  if (daily.loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  if (daily.phase === 'empty') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <DailyStatusHero
          kind="empty"
          primaryTo="/reader"
          primaryLabel="Đọc bài để lưu thêm từ"
          secondaryTo="/"
          secondaryLabel="Về trang chủ"
        />
      </div>
    )
  }

  // Màn tổng kết chiếm trọn màn hình nên thanh tiến độ lùi đi trong lúc đó.
  const showProgress = daily.phase !== 'done' && !daily.justFinished

  return (
    <main className="study-chamber">
      <header className="study-chamber__header"><div><span>Full session · learning energy</span><h2>Signal calibration</h2></div><div><b>{daily.stepsDone}/{daily.stepsTotal}</b><small>signals stabilized</small></div></header>
      <div className="study-chamber__orb"><AiOrb state={daily.phase === 'done' ? 'success' : daily.phase === 'dictation' ? 'listening' : 'idle'} compact /></div>
    <div className="study-chamber__content">
      {showProgress && (
        <DailyProgress
          phase={daily.phase}
          stepsDone={daily.stepsDone}
          stepsTotal={daily.stepsTotal}
          combo={combo}
        />
      )}

      {daily.phase === 'review' && <ReviewStep daily={daily} onCorrectStreak={setCombo} />}
      {daily.phase === 'weak' && <WeakStep daily={daily} onCorrectStreak={setCombo} />}
      {daily.phase === 'speak' && <SpeakStep words={daily.speakWords} onDone={daily.afterSpeak} />}
      {daily.phase === 'flip' && <FlipStep daily={daily} />}
      {daily.phase === 'dictation' && <DictationStep daily={daily} onCorrectStreak={setCombo} />}
      {daily.phase === 'split' && <SplitStep daily={daily} onCorrectStreak={setCombo} />}

      {daily.phase === 'game' && (
        daily.justFinished
          ? <DailySummary daily={daily} onContinue={() => daily.setJustFinished(false)} />
          : <DailyGamePanel />
      )}

      {daily.phase === 'done' && (
        <div className="mx-auto max-w-4xl">
          <DailyStatusHero
            kind="complete"
            primaryTo="/"
            primaryLabel="Về trang chủ"
            secondaryTo="/reader"
            secondaryLabel="Đọc bài"
          />
        </div>
      )}
    </div>
    </main>
  )
}
