import client from './client'
import type { DailyGame, DailyHome, DailySession, DailyStatus, DailyWord, GameChip, GameConfirmResult } from '../types'

export const getDailySession = (mode: 'full' | 'quick' = 'full') => client.get<{ session: DailySession | null }>('/daily/session', { params: { mode } }).then(r => r.data.session)
export const postDailyAnswer = (cardId: string, step: string, correct: boolean, mode: 'full' | 'quick' = 'full') => client.post<DailyWord>('/daily/answer', { card_id: cardId, step, correct, mode }).then(r => r.data)
export const completeLearning = (mode: 'full' | 'quick' = 'full') => client.post<{ session: DailySession | null }>('/daily/complete-learning', undefined, { params: { mode } }).then(r => r.data.session)
export const getDailyGame = () => client.get<DailyGame>('/daily/game').then(r => r.data)
export const postGameFound = (selection: { start_row: number; start_col: number; end_row: number; end_col: number }) => client.post<{ matched: GameChip | null }>('/daily/game/found', selection).then(r => r.data.matched)
export const postGameHint = (token: string) => client.post<{ level: number; text: string }>('/daily/game/hint', { token }).then(r => r.data)
export const confirmGame = (pairs: { card_id: string; token: string }[]) => client.post<{ results: GameConfirmResult[] }>('/daily/game/confirm', { pairs }).then(r => r.data.results)
export const getDailyStatus = () => client.get<DailyStatus>('/daily/status').then(r => r.data)
export const getDailyHome = () => client.get<DailyHome>('/daily/home').then(r => r.data)
