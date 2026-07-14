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
  rating_source?: 'manual' | 'auto'
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
