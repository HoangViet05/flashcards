import client from './client'
import type { HeatmapDay, Review, ReviewSubmission, Stats } from '../types'

export const getDueCards = () => client.get<Review[]>('/review/due').then(r => r.data)
export const submitReview = (cardId: string, submission: ReviewSubmission) =>
  client.post<Review>(`/review/${cardId}`, submission).then(r => r.data)
export const getStats = () => client.get<Stats>('/review/stats').then(r => r.data)
export const getHeatmap = (days = 365) => client.get<HeatmapDay[]>('/review/heatmap', { params: { days } }).then(r => r.data)
