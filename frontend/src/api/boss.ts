import client from './client'
export type BossCurrent = { available: boolean; week_start: string; snapshot_token?: string; challenge?: { duration_minutes: number; vocabulary_card_ids: string[] }; best_score?: number | null; best_medal?: string | null }
export type BossResult = { score: number; medal: string | null; best_score: number; best_medal: string | null; xp_awarded: number; unlocks: string[] }
export const getCurrentBoss = () => client.get<BossCurrent>('/boss/current').then(result => result.data)
export const completeBoss = (body: { snapshot_token: string; idempotency_key: string; vocabulary_correct: number; reading_correct: number; listening_correct: number; speaking_score?: number | null; duration_seconds: number }) => client.post<BossResult>('/boss/complete', body).then(result => result.data)
