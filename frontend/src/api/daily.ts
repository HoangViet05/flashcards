import client from './client'
import type { DailyGame, DailySession, DailyStatus, DailyWord, GameChip, GameConfirmResult } from '../types'

export const getDailySession = () => client.get<{ session: DailySession | null }>('/daily/session').then(r => r.data.session)
export const postDailyAnswer = (cardId: string, step: string, correct: boolean) => client.post<DailyWord>('/daily/answer', { card_id: cardId, step, correct }).then(r => r.data)
export const completeLearning = () => client.post<{ session: DailySession | null }>('/daily/complete-learning').then(r => r.data.session)
export const getDailyGame = () => client.get<DailyGame>('/daily/game').then(r => r.data)
export const postGameFound = (selection: { start_row: number; start_col: number; end_row: number; end_col: number }) => client.post<{ matched: GameChip | null }>('/daily/game/found', selection).then(r => r.data.matched)
export const postGameHint = (token: string) => client.post<{ level: number; text: string }>('/daily/game/hint', { token }).then(r => r.data)
export const confirmGame = (pairs: { card_id: string; token: string }[]) => client.post<{ results: GameConfirmResult[] }>('/daily/game/confirm', { pairs }).then(r => r.data.results)
export const getDailyStatus = () => client.get<DailyStatus>('/daily/status').then(r => r.data)
