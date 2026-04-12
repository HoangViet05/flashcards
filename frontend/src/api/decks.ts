import client from './client'
import type { Deck } from '../types'

export const getDecks = () => client.get<Deck[]>('/decks').then(r => r.data)
export const getDeck = (id: string) => client.get<Deck>(`/decks/${id}`).then(r => r.data)
export const createDeck = (data: { name: string; description?: string }) =>
  client.post<Deck>('/decks', data).then(r => r.data)
export const updateDeck = (id: string, data: { name?: string; description?: string }) =>
  client.put<Deck>(`/decks/${id}`, data).then(r => r.data)
export const deleteDeck = (id: string) => client.delete(`/decks/${id}`)
