import client from './client'
import type { User } from '../types'

export interface AuthResponse {
  access_token: string
  token_type: 'bearer'
  user: User
}

export interface ReminderSettingsPayload {
  reminder_enabled: boolean
  reminder_time: string
  timezone: string
}

export const register = (payload: { email: string; password: string; name?: string }) =>
  client.post<AuthResponse>('/auth/register', payload).then(r => r.data)

export const login = (payload: { email: string; password: string }) =>
  client.post<AuthResponse>('/auth/login', payload).then(r => r.data)

export const getMe = () => client.get<User>('/auth/me').then(r => r.data)

export const updateReminderSettings = (payload: ReminderSettingsPayload) =>
  client.put<User>('/auth/reminder', payload).then(r => r.data)
