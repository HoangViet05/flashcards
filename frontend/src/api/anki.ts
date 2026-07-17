import client from './client'

export interface AnkiImportResult {
  entries_imported: number
  entries_skipped: number
  warnings: string[]
}

export const importApkg = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return client
    .post<AnkiImportResult>('/anki/import', form, { timeout: 0 })
    .then(r => r.data)
}
