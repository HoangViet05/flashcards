import type { GameMode, ReviewSubmission } from '../../types'

export const englishPart = (example: string) => example.replace(/\s*\([^)]*\)\s*$/, '').trim()
export const cleanFront = (front: string) => front.match(/[A-Za-z][A-Za-z\s'-]*/)?.[0].trim().toLowerCase() ?? front.trim().toLowerCase()

export function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result
}

export const qualityFor = (attempts: number, correct: boolean): 5 | 3 | 1 => !correct ? 1 : attempts <= 1 ? 5 : 3

export interface GameOutcome {
  cardId: string
  quality: 5 | 3 | 1
  attempts: number
  correct: boolean
  timeMs: number
}

export const RATING_SOURCE: Record<GameMode, ReviewSubmission['rating_source']> = {
  sentence: 'game_sentence', cloze: 'game_cloze', match: 'game_match',
}
