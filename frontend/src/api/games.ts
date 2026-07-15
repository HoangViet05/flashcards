import client from './client'
import type { Card, GameMode } from '../types'

export const getGameCards = (mode: GameMode, opts: { deckId?: string; limit?: number } = {}) =>
  client.get<Card[]>('/games/cards', { params: { mode, deck_id: opts.deckId, limit: opts.limit ?? 10 } }).then(response => response.data)
