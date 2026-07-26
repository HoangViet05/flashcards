import client from './client'
import type { WeakWord, WordState } from '../types'

export const getWeakWords = () => client.get<WeakWord[]>('/review/weak').then(response => response.data)

export const answerWeakWord = (cardId: string, correct: boolean) =>
  client.post(`/review/weak/${cardId}`, { correct }).then(() => undefined)

export const getWordStates = (articleId: string) =>
  client.get<{ states: Record<string, WordState> }>(`/articles/${articleId}/word-states`)
    .then(response => response.data.states)
