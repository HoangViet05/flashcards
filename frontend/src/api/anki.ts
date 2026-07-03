import client from './client'

export interface AnkiImportResult {
  decks_created: number
  cards_created: number
  decks_skipped: number
  cards_skipped: number
  warnings: string[]
}

export const importApkg = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return client
    .post<AnkiImportResult>('/anki/import', form, { timeout: 0 })
    .then(r => r.data)
}
