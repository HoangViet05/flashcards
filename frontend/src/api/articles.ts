import client from './client'
import type { Article, ArticleListItem } from '../types'

export type ArticleInput =
  | { title?: string; text: string }
  | { title?: string; url: string }
  | { title?: string; document_id: string }

export const getArticles = () => client.get<ArticleListItem[]>('/articles').then(response => response.data)
export const getArticle = (id: string) => client.get<Article>(`/articles/${id}`).then(response => response.data)
export const createArticle = (input: ArticleInput) => client.post<Article>('/articles', input).then(response => response.data)
export const deleteArticle = (id: string) => client.delete(`/articles/${id}`)
