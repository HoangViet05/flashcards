import client from './client'
import type { Card } from '../types'

export async function getCards(
  deckId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: Card[]; total: number }> {
  const res = await client.get<Card[]>(`/decks/${deckId}/cards`, {
    params: { limit: opts.limit ?? 100, offset: opts.offset ?? 0 },
  })
  return {
    items: res.data,
    total: Number(res.headers['x-total-count'] ?? res.data.length),
  }
}

/** Fetch every page for flows that genuinely require a complete deck (review/practice). */
export async function getAllCards(deckId: string): Promise<Card[]> {
  const items: Card[] = []
  const limit = 200
  let total = Number.POSITIVE_INFINITY

  while (items.length < total) {
    const page = await getCards(deckId, { limit, offset: items.length })
    items.push(...page.items)
    total = page.total
    if (page.items.length === 0) break
  }

  return items
}

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
