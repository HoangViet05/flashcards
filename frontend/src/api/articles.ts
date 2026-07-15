import client from './client'
import type { Article, ArticleHighlight, ArticleListItem } from '../types'

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
