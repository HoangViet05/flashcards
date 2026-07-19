export interface Deck {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  card_count: number
  due_count: number
  new_count: number
}

export interface Card {
  id: string
  deck_id: string
  front_text: string
  back_text: string
  example_sentence: string | null
  pronunciation: string | null
  definition: string | null
  image_url: string | null
  audio_url: string | null
  example_audio_url: string | null
  created_at: string
  updated_at: string
  review: Review | null
}

export type StudyVariant = 'standard' | 'cloze' | 'reverse'

export interface Review {
  id: string
  card_id: string
  ease_factor: number
  interval: number
  repetitions: number
  due_date: string
  last_quality: number | null
  last_auto_quality: number | null
  last_rating_source: string | null
  last_response_time_ms: number | null
  last_flip_count: number | null
  last_audio_play_count: number | null
  last_answer_mode: string | null
  last_answer_correct: boolean | null
  last_attempt_count: number | null
  reviewed_at: string | null
}

export interface ReviewSubmission {
  quality: number
  auto_quality?: number | null
  rating_source?: 'manual' | 'auto' | 'game_sentence' | 'game_cloze' | 'game_match' | 'shadowing'
  response_time_ms?: number | null
  flip_count?: number | null
  audio_play_count?: number | null
  answer_mode?: 'self-check' | 'typed-answer' | null
  answer_correct?: boolean | null
  attempt_count?: number | null
}

export interface Stats {
  streak: number
  total_cards: number
  total_reviewed_today: number
  due_today: number
  new_cards: number
  due_upcoming: Record<string, number>
  mastered_cards: number
  total_reviews: number
  reviews_by_source: Record<string, number>
}

export type GameMode = 'sentence' | 'cloze' | 'match'

export interface HeatmapDay {
  date: string
  count: number
}

export interface ArticleListItem {
  id: string
  title: string
  source_type: 'paste' | 'url' | 'pdf' | 'rss'
  source_url: string | null
  word_count: number
  has_summary: boolean
  translation_status: TranslationStatus | null
  created_at: string
}

export interface Article extends ArticleListItem {
  content: string
  document_id: string | null
  deck_id: string | null
  summary: string | null
}

export type TranslationStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface ArticleTranslation {
  id: string
  article_id: string
  status: TranslationStatus
  translated_content: string | null
  segments: { source: string; translated: string }[] | null
  error_message: string | null
  requested_at: string
  completed_at: string | null
}

export interface LocalTranslationWorker {
  id: string
  name: string
  created_at: string
  last_seen_at: string | null
}

export interface CreatedTranslationWorker extends LocalTranslationWorker {
  token: string
}

export interface ArticleHighlight {
  id: string
  word: string
  meaning: string | null
  created_at: string
}

export interface ArticleHighlightCardsResult {
  deck_id: string
  cards_created: number
  cards_skipped: number
  anki_matches: number
}

export interface DictionaryResult {
  word: string
  matched_word: string
  pronunciation: string | null
  content: string
}

export interface EnDictResult {
  word: string
  phonetic: string | null
  audioUrl: string | null
  meanings: { partOfSpeech: string; definitions: string[] }[]
}

export interface Document {
  id: string
  filename: string
  status: 'processing' | 'ready' | 'error'
  page_count: number | null
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  name: string | null
  created_at: string
}

export interface ShadowSegment { start: number; end: number; text: string }
export interface ShadowVideoListItem { id: string; youtube_id: string; title: string; duration_s: number | null; segment_count: number; created_at: string }
export interface ShadowVideo extends ShadowVideoListItem { segments: ShadowSegment[] }
export interface ShadowVideoCreateInput { youtube_id: string; title: string; duration_s: number | null; segments: ShadowSegment[] }
export type ShadowWordStatus = 'correct' | 'missed' | 'substituted' | 'skipped'
export interface ShadowWordResult { word: string; status: ShadowWordStatus }
export interface ShadowScore { transcript: string; score: number; words: ShadowWordResult[]; no_speech: boolean }
export interface ShadowCard { id: string; front_text: string; example_sentence: string; example_audio_url: string; pronunciation: string | null }
export interface ShadowAttemptInput { source_type: 'card' | 'article' | 'youtube'; card_id: string | null; article_id: string | null; video_id: string | null; segment_index: number | null; target_text: string; transcript: string; score: number; word_results: ShadowWordResult[] }
export interface ShadowingDayStat { date: string; count: number; avg_score: number | null }
export interface ShadowingStats { total_attempts: number; attempts_7d: number; avg_score_7d: number | null; by_day: ShadowingDayStat[] }
