import client from './client'
import type { Card } from '../types'

export const getCards = (deckId: string) =>
  client.get<Card[]>(`/decks/${deckId}/cards`).then(r => r.data)

export const createCard = (deckId: string, data: {
  front_text: string
  back_text: string
  example_sentence?: string
  image_url?: string
  audio_url?: string
}) => client.post<Card>(`/decks/${deckId}/cards`, data).then(r => r.data)

export const updateCard = (id: string, data: Partial<Card>) =>
  client.put<Card>(`/cards/${id}`, data).then(r => r.data)

export const deleteCard = (id: string) => client.delete(`/cards/${id}`)
