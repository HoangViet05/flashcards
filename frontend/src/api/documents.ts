import client from './client'
import { Document } from '../types'

export const getDocuments = async (): Promise<Document[]> => {
  const { data } = await client.get('/documents')
  return data
}

export const getDocument = async (id: string): Promise<Document> => {
  const { data } = await client.get(`/documents/${id}`)
  return data
}

export const uploadDocument = async (file: File): Promise<Document> => {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await client.post('/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return data
}

export const deleteDocument = async (id: string): Promise<void> => {
  await client.delete(`/documents/${id}`)
}
