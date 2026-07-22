import client from './client'
import type { Article, ArticleHighlight, ArticleHighlightCardsResult, ArticleListItem, ArticleTranslation, Card, CreatedTranslationWorker, LocalTranslationWorker } from '../types'

export type ArticleInput =
  | { title?: string; text: string }
  | { title?: string; url: string }
  | { title?: string; document_id: string }

export const getArticles = () => client.get<ArticleListItem[]>('/articles').then(response => response.data)
export const getArticle = (id: string) => client.get<Article>(`/articles/${id}`).then(response => response.data)
export const createArticle = (input: ArticleInput) => client.post<Article>('/articles', input).then(response => response.data)
export const deleteArticle = (id: string) => client.delete(`/articles/${id}`)
export const getArticleHighlights = (id: string) => client.get<ArticleHighlight[]>(`/articles/${id}/highlights`).then(response => response.data)
export const saveArticleHighlight = (articleId: string, word: string, meaning: string | null) => client.post<ArticleHighlight>(`/articles/${articleId}/highlights`, { word, meaning }).then(response => response.data)
export const deleteArticleHighlight = (articleId: string, word: string) => client.delete(`/articles/${articleId}/highlights/${encodeURIComponent(word)}`)
export const createArticleCard = (articleId: string, data: {
  word: string
  back_text: string
  example_sentence?: string
  pronunciation?: string
  definition?: string
  image_url?: string
  audio_url?: string
  example_audio_url?: string
}) => client.post<Card>(`/articles/${articleId}/cards`, data).then(response => response.data)
export type HighlightCardMetadata = {
  word: string
  pronunciation?: string
  definition?: string
  audio_url?: string
}

export const addArticleHighlightsToDeck = (articleId: string, cards: HighlightCardMetadata[] = []) =>
  client.post<ArticleHighlightCardsResult>(`/articles/${articleId}/highlights/to-deck`, { cards }).then(response => response.data)
export const queueArticleTranslation = (id: string, force = false) => client.post<ArticleTranslation>(`/articles/${id}/translation-jobs`, { force }).then(response => response.data)
export const queueUntranslatedArticles = () => client.post<{ queued_count: number; already_pending_count: number }>('/articles/translation-jobs/untranslated').then(response => response.data)
export const getArticleTranslation = (id: string) => client.get<ArticleTranslation>(`/articles/${id}/translation`).then(response => response.data)
export const createTranslationWorker = (name = 'Máy dịch local') => client.post<CreatedTranslationWorker>('/articles/translation-workers', { name }).then(response => response.data)
export const getTranslationWorkers = () => client.get<LocalTranslationWorker[]>('/articles/translation-workers/status').then(response => response.data)
export const deleteTranslationWorker = (id: string) => client.delete(`/articles/translation-workers/${id}`)
