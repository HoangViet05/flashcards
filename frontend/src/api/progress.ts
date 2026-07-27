import client from './client'
import type { CalendarDay, DayDetail, ProgressOverview } from '../types'

export const getProgressOverview = () => client.get<ProgressOverview>('/progress/overview').then(result => result.data)
export const getCalendar = (days = 84) => client.get<CalendarDay[]>(`/progress/calendar?days=${days}`).then(result => result.data)
export const getDayDetail = (day: string) => client.get<DayDetail>(`/progress/day/${day}`).then(result => result.data)
