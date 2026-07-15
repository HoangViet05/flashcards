import axios from 'axios'
import client from './client'
import type { DictionaryResult, EnDictResult } from '../types'

export async function lookupViDictionary(word: string): Promise<DictionaryResult | null> {
  try {
    return (await client.get<DictionaryResult>(`/dictionary/${encodeURIComponent(word)}`)).data
  } catch {
    return null
  }
}

const CACHE_PREFIX = 'endict:'
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000

export async function lookupEnDictionary(word: string): Promise<EnDictResult | null> {
  const key = CACHE_PREFIX + word.toLowerCase()
  try {
    const cached = JSON.parse(window.localStorage.getItem(key) ?? 'null') as { at: number; data: EnDictResult | null } | null
    if (cached && Date.now() - cached.at < CACHE_TTL) return cached.data
  } catch { /* ignore a corrupt cache value */ }

  let result: EnDictResult | null = null
  try {
    const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`, { timeout: 8000 })
    const first = response.data[0]
    if (first) {
      result = {
        word: first.word,
        phonetic: first.phonetic ?? first.phonetics?.find((item: { text?: string }) => item.text)?.text ?? null,
        audioUrl: first.phonetics?.find((item: { audio?: string }) => item.audio)?.audio ?? null,
        meanings: (first.meanings ?? []).slice(0, 3).map((meaning: { partOfSpeech: string; definitions: { definition: string }[] }) => ({
          partOfSpeech: meaning.partOfSpeech,
          definitions: meaning.definitions.slice(0, 2).map(definition => definition.definition),
        })),
      }
    }
  } catch { /* a missing word or network failure remains usable with EN-VI */ }
  try { window.localStorage.setItem(key, JSON.stringify({ at: Date.now(), data: result })) } catch { /* quota/private mode */ }
  return result
}
