import type { AxiosProgressEvent } from 'axios'
import client from './client'

export interface AnkiLibrarySource {
  name: string
  entry_count: number
}

export interface AnkiLibraryEntry {
  id: string
  front_text: string
  back_text: string
  pronunciation: string | null
  definition: string | null
  example_sentence: string | null
  image_url: string | null
  audio_url: string | null
  example_audio_url: string | null
  source_deck: string | null
  imported_at: string
}

export interface AnkiLibrary {
  total: number
  sources: AnkiLibrarySource[]
  entries: AnkiLibraryEntry[]
}

export interface AnkiImportResult {
  entries_imported: number
  entries_skipped: number
  warnings: string[]
}

export const importApkg = (
  file: File,
  onUploadProgress?: (progressEvent: AxiosProgressEvent) => void,
) => {
  const form = new FormData()
  form.append('file', file)
  return client
    .post<AnkiImportResult>('/anki/import', form, { timeout: 0, onUploadProgress })
    .then(r => r.data)
}

export const getAnkiLibrary = (search = '') =>
  client.get<AnkiLibrary>('/anki/library', { params: search ? { search } : undefined }).then(r => r.data)
