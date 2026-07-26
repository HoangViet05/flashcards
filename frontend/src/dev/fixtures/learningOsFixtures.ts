export type FixtureSurface = 'today' | 'study' | 'reader' | 'shadowing'
export type FixtureState = 'loaded' | 'slow' | 'empty' | 'active' | 'correct' | 'summary' | 'focus' | 'word' | 'audio' | 'ready' | 'recording' | 'score' | 'offline'

export const fixtureStates: Record<FixtureSurface, FixtureState[]> = {
  today: ['loaded', 'slow', 'empty'],
  study: ['active', 'correct', 'summary'],
  reader: ['focus', 'word', 'audio'],
  shadowing: ['ready', 'recording', 'score', 'offline'],
}

export const fixtureCopy: Record<FixtureSurface, Record<string, { kicker: string; title: string; detail: string }>> = {
  today: {
    loaded: { kicker: 'Daily core · 72% charged', title: 'Keep your momentum alive.', detail: '8 reviews, 6 new words and one listening sprint are ready.' },
    slow: { kicker: 'Starting your learning space…', title: 'Your route is standing by.', detail: 'Cached missions and progress remain visible while we reconnect.' },
    empty: { kicker: 'Your first signal', title: 'Build a path that fits your work.', detail: 'Choose a reading or import the vocabulary you actually need.' },
  },
  study: {
    active: { kicker: 'Full session · Listening', title: 'Signal calibration', detail: 'Listen once, type what you hear, then lock your answer.' },
    correct: { kicker: 'Signal locked · +4 XP', title: 'Exactly right.', detail: 'Your energy and combo are visibly moving forward.' },
    summary: { kicker: 'Session core stabilized', title: 'You showed up and moved forward.', detail: '24 focused minutes, 87% accuracy and +76 XP.' },
  },
  reader: {
    focus: { kicker: 'Focus reader · Level 2', title: 'Why psychological safety matters at work', detail: 'The article remains the dominant, calm surface.' },
    word: { kicker: 'Word in context', title: 'Clarify the idea, not every word.', detail: 'One companion dock replaces floating dictionary panels.' },
    audio: { kicker: 'Audio reader', title: 'Listen without losing your place.', detail: 'Transport and transcript belong in the same companion dock.' },
  },
  shadowing: {
    ready: { kicker: 'Voice calibration · Line 2 of 5', title: 'Speak with clarity.', detail: 'Listen to the sample, then hold the control to record.' },
    recording: { kicker: 'Recording · 00:04', title: 'Your voice is in motion.', detail: 'A reactive waveform and live transcript make the state obvious.' },
    score: { kicker: 'Voice calibrated · 86', title: 'Clear and confident.', detail: 'One useful pronunciation note, then retry or move forward.' },
    offline: { kicker: 'Worker offline', title: 'Practice stays available.', detail: 'You can listen and record locally; scoring waits for reconnection.' },
  },
}
