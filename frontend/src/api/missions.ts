import client from './client'
import type { Journey, Mission } from '../types'
export const rerollMission = (id: string) => client.post<Mission>(`/missions/${id}/reroll`).then(result => result.data)
export const getJourney = () => client.get<Journey>('/journey/week').then(result => result.data)
