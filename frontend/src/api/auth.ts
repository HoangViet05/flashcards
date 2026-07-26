import client from './client'
import type { ReadingLevel, User } from '../types'

export interface AuthResponse {
  access_token: string
  token_type: 'bearer'
  user: User
}

export const register = (payload: { email: string; password: string; name?: string }) =>
  client.post<AuthResponse>('/auth/register', payload).then(r => r.data)

export const login = (payload: { email: string; password: string }) =>
  client.post<AuthResponse>('/auth/login', payload).then(r => r.data)

export const getMe = () => client.get<User>('/auth/me').then(r => r.data)

export const updatePreferences = (preferredLevel: ReadingLevel) =>
  client.patch<User>('/auth/me/preferences', { preferred_level: preferredLevel }).then(r => r.data)
