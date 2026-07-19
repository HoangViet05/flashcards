import client from './client'
import type { ShadowAttemptInput, ShadowCard, ShadowingStats, ShadowVideo, ShadowVideoCreateInput, ShadowVideoListItem } from '../types'
export const getShadowCards = (params: { deckId?: string; cardId?: string; dueOnly?: boolean } = {}) => client.get<ShadowCard[]>('/shadowing/cards', { params: { deck_id: params.deckId, card_id: params.cardId, due_only: params.dueOnly } }).then(response => response.data)
export const createShadowVideo = (input: ShadowVideoCreateInput) => client.post<ShadowVideo>('/shadowing/videos', input).then(response => response.data)
export const getShadowVideos = () => client.get<ShadowVideoListItem[]>('/shadowing/videos').then(response => response.data)
export const getShadowVideo = (id: string) => client.get<ShadowVideo>(`/shadowing/videos/${id}`).then(response => response.data)
export const deleteShadowVideo = (id: string) => client.delete(`/shadowing/videos/${id}`)
export const createShadowAttempt = (input: ShadowAttemptInput) => client.post<{ id: string }>('/shadowing/attempts', input).then(response => response.data)
export const getShadowingStats = () => client.get<ShadowingStats>('/shadowing/stats').then(response => response.data)
