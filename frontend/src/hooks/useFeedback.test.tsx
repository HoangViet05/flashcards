import { render } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

// api/auth kéo theo axios -> form-data -> mime-db, và mime-db không resolve được
// './db.json' khi chạy dưới Node. Test này không gọi API nên mock đứt chuỗi đó.
vi.mock('../api/auth', () => ({
  updatePreferences: vi.fn(async () => ({})),
  getMe: vi.fn(async () => ({})),
  login: vi.fn(), register: vi.fn(),
}))

import { useFeedback } from './useFeedback'
import { AudioProvider } from '../providers/AudioProvider'
import { AuthContext } from '../auth/AuthContext'
import type { User } from '../types'

const played: string[] = []
const vibrated: Array<number | number[]> = []

class FakeAudio {
  volume = 1; currentTime = 0; loop = false
  constructor(public src: string) {}
  play() { played.push(this.src); return Promise.resolve() }
  pause() {}
}

function makeUser(overrides: Record<string, unknown>): User {
  return { id: 'u1', email: 'a@b.c', name: 'A', preferences: {
    sfx_enabled: true, haptic_enabled: true, feedback_enabled: true, silent_mode: false,
    sfx_volume: 1, master_volume: 1, ...overrides,
  } } as unknown as User
}

function mount(user: User) {
  let api!: ReturnType<typeof useFeedback>
  function Probe() { api = useFeedback(); return null }
  render(
    <AuthContext.Provider value={{ user, setUser: () => undefined } as never}>
      <AudioProvider><Probe /></AudioProvider>
    </AuthContext.Provider>,
  )
  return api
}

beforeEach(() => {
  played.length = 0; vibrated.length = 0
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('navigator', { ...navigator, vibrate: (pattern: number | number[]) => { vibrated.push(pattern); return true } })
})

it('plays the correct sound and a short buzz on a right answer', () => {
  mount(makeUser({})).correct()
  expect(played.some(src => src.includes('correct.wav'))).toBe(true)
  expect(vibrated).toEqual([10])
})

it('escalates to the combo asset only from the third answer in a row', () => {
  const api = mount(makeUser({}))
  api.combo(2)
  expect(played.some(src => src.includes('combo.wav'))).toBe(false)
  api.combo(3)
  expect(played.some(src => src.includes('combo.wav'))).toBe(true)
})

it('plays the level-up asset on level up', () => {
  mount(makeUser({})).levelUp('vocabulary', 3)
  expect(played.some(src => src.includes('levelup.wav'))).toBe(true)
})

it('stays silent for mid-session xp so it does not stack on the answer sound', () => {
  mount(makeUser({})).xpGained(4)
  expect(played).toHaveLength(0)
})

it('plays the combo asset for end-of-session xp', () => {
  mount(makeUser({})).xpGained(40, { final: true })
  expect(played.some(src => src.includes('combo.wav'))).toBe(true)
})

it('does not vibrate when haptic_enabled is off', () => {
  mount(makeUser({ haptic_enabled: false })).correct()
  expect(vibrated).toHaveLength(0)
})

it('does nothing at all when feedback_enabled is off', () => {
  mount(makeUser({ feedback_enabled: false })).correct()
  expect(played).toHaveLength(0)
  expect(vibrated).toHaveLength(0)
})
