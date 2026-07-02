export interface Deck {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
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

export interface Review {
  id: string
  card_id: string
  ease_factor: number
  interval: number
  repetitions: number
  due_date: string
  last_quality: number | null
  reviewed_at: string | null
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
