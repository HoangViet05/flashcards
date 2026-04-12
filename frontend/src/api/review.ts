import client from './client'
import type { Review, Stats } from '../types'

export const getDueCards = () => client.get<Review[]>('/review/due').then(r => r.data)
export const submitReview = (cardId: string, quality: number) =>
  client.post<Review>(`/review/${cardId}`, { quality }).then(r => r.data)
export const getStats = () => client.get<Stats>('/review/stats').then(r => r.data)
