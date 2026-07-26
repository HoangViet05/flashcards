import client from './client'
import type { Article, CatalogDetail, CatalogListItem, ReadingLevel } from '../types'

export const getCatalog = (level: ReadingLevel) => client.get<CatalogListItem[]>('/catalog', { params: { level } }).then(response => response.data)
export const getCatalogArticle = (id: string) => client.get<CatalogDetail>(`/catalog/${id}`).then(response => response.data)
export const adoptCatalogArticle = (id: string) => client.post<Article>(`/catalog/${id}/adopt`).then(response => response.data)
