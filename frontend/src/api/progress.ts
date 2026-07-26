import client from './client'
import type { ProgressOverview } from '../types'
export const getProgressOverview = () => client.get<ProgressOverview>('/progress/overview').then(result => result.data)
