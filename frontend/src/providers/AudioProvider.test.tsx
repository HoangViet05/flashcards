import { render } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

// api/auth kéo theo axios -> form-data -> mime-db, và mime-db không resolve được
// './db.json' khi chạy dưới Node. Test này không gọi API nên mock đứt chuỗi đó.
vi.mock('../api/auth', () => ({
  updatePreferences: vi.fn(async () => ({})),
  getMe: vi.fn(async () => ({})),
  login: vi.fn(), register: vi.fn(),
}))

import { AudioProvider, useAudio } from './AudioProvider'
import { AuthContext } from '../auth/AuthContext'
import type { User } from '../types'

const played: Array<{ src: string; volume: number; element: object }> = []

class FakeAudio {
  volume = 1
  currentTime = 0
  loop = false
  constructor(public src: string) {}
  play() { played.push({ src: this.src, volume: this.volume, element: this }); return Promise.resolve() }
  pause() {}
}

function makeUser(overrides: Record<string, unknown>): User {
  return { id: 'u1', email: 'a@b.c', name: 'A', preferences: {
    sfx_enabled: true, haptic_enabled: true, feedback_enabled: true, silent_mode: false,
    sfx_volume: 0.5, master_volume: 0.8,
    ...overrides,
  } } as unknown as User
}

function Probe({ onReady }: { onReady: (api: ReturnType<typeof useAudio>) => void }) {
  onReady(useAudio())
  return null
}

function mount(user: User) {
  let api!: ReturnType<typeof useAudio>
  render(
    <AuthContext.Provider value={{ user, setUser: () => undefined } as never}>
      <AudioProvider><Probe onReady={value => { api = value }} /></AudioProvider>
    </AuthContext.Provider>,
  )
  return api
}

beforeEach(() => { played.length = 0; vi.stubGlobal('Audio', FakeAudio) })

it('plays at sfx_volume multiplied by master_volume', () => {
  mount(makeUser({})).sfx('correct')
  expect(played).toHaveLength(1)
  expect(played[0].src).toContain('/audio/correct.wav')
  expect(played[0].volume).toBeCloseTo(0.4)
})

it('reuses one audio element when the same asset plays twice', () => {
  const api = mount(makeUser({}))
  api.sfx('correct'); api.sfx('correct')
  expect(played).toHaveLength(2)
  expect(played[0].element).toBe(played[1].element)
})

it('stays silent when sfx_enabled is off', () => {
  mount(makeUser({ sfx_enabled: false })).sfx('correct')
  expect(played).toHaveLength(0)
})

it('stays silent when silent_mode is on', () => {
  mount(makeUser({ silent_mode: true })).sfx('correct')
  expect(played).toHaveLength(0)
})
