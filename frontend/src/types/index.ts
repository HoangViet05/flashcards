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
  source_type: string | null
  source_name: string | null
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

export interface HeatmapDay {
  date: string
  count: number
}

export interface ArticleListItem {
  id: string
  title: string
  source_type: 'paste' | 'url' | 'pdf' | 'rss' | 'catalog'
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
  level?: ReadingLevel | null
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
  anki_match: boolean
  anki_source_deck: string | null
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

export interface User {
  id: string
  email: string
  name: string | null
  preferred_level: ReadingLevel | null
  created_at: string
  preferences?: UserPreferences | null
}

export type ThemeMode = 'system' | 'light' | 'dark'
export type AccentTheme = 'violet-cyan' | 'blue-emerald' | 'amber-rose' | 'graphite-ice'
export interface UserPreferences {
  ui_theme: ThemeMode; accent_theme: AccentTheme; reduce_effects: boolean; daily_goal_minutes: number; timezone: string; work_goal: 'reading' | 'listening' | 'conversation' | 'balanced'
  preferred_voice_name: string | null; preferred_voice_locale: string | null; speech_rate: number
  music_enabled: boolean; sfx_enabled: boolean; feedback_enabled: boolean; pronunciation_enabled: boolean; haptic_enabled: boolean
  master_volume: number; music_volume: number; sfx_volume: number; feedback_volume: number; pronunciation_volume: number; silent_mode: boolean
  silent_profile: Record<string, boolean>; onboarding_completed_at: string | null
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

export type ExerciseStep = 'dictation' | 'vi_en' | 'en_vi'
export interface DailyWord { id: string; card_id: string; is_new: boolean; is_weak: boolean; assigned_step: ExerciseStep; steps_done: string[]; wrong_count: number; card: Card }
export interface DailySession { id: string; session_date: string; mode?: 'full' | 'quick'; status: 'learning' | 'game' | 'done'; phase: 'review' | 'flip' | 'dictation' | 'split' | 'game'; duration_seconds?: number; words: DailyWord[] }
export interface DailyStatus { new_remaining: number; low_new_words: boolean; session_status: 'none' | 'learning' | 'game' | 'done'; session_date: string | null; new_count: number; due_count: number }
export interface LatestArticle { id: string; title: string; unlearned_saved_words: number }
export interface DailyHome {
  new_count: number; due_count: number; session_status: 'none' | 'learning' | 'game' | 'done'
  steps_total: number; steps_done: number; streak: number; studied_today: boolean
  mastered_cards: number; total_cards: number; deck_count: number
  low_new_words: boolean; new_remaining: number; latest_article: LatestArticle | null
  progression?: ProgressOverview; missions?: { daily: Mission[]; weekly: Mission[] }; journey?: Journey; server_time?: string
}
export interface SkillProgressOverview { skill: 'vocabulary' | 'reading' | 'listening' | 'speaking'; xp: number; level: number; mastery: number | null; building_signal: boolean }
export interface ProgressOverview { streak: number; study_minutes_today: number; study_minutes_week: number; remembered_cards: number; retention: number | null; skills: SkillProgressOverview[]; heatmap: Record<string, number>; unlocks: string[] }
export interface Mission { id: string; mission_key: string; skill: string; target: number; progress: number; completed_at: string | null; rerolled: boolean }
export interface Journey { week_start: string; timezone: string; boss_available: boolean; lanes: { skill: string; checkpoints: { date: string; active: boolean }[] }[] }
export interface GameMeaning { token: string; meaning: string; hint_level: number }
export interface GameChip { card_id: string; word: string; cells: number[][] | null }
export interface DailyGame { size: number; grid: string[][]; meanings: GameMeaning[]; found: GameChip[]; total_words: number; status: string }
export interface GameConfirmResult { card_id: string; word: string; meaning: string; correct: boolean; quality_after: number | null }

export type WordState = 'learning' | 'mastered' | 'weak'

export interface WeakWord {
  card: Card
  recent_wrong: number
  total_reviews: number
  last_step: ExerciseStep | null
  suggested_step: ExerciseStep
}

export type ReadingLevel = 1 | 2 | 3

export const READING_LEVEL_LABELS: Record<ReadingLevel, string> = {
  1: 'Mới bắt đầu',
  2: 'Cơ bản',
  3: 'Trung cấp',
}

export interface CatalogListItem {
  id: string
  title: string
  level: ReadingLevel
  word_count: number
  source: 'voa' | 'simplewiki'
  attribution: string
  audio_url: string | null
  suggested_word_count: number
  already_added: boolean
  published_at: string | null
}

export interface CatalogDetail {
  id: string
  title: string
  content: string
  level: ReadingLevel
  word_count: number
  source: 'voa' | 'simplewiki'
  source_url: string
  license: string
  attribution: string
  audio_url: string | null
  suggested_words: string[]
  already_added: boolean
}
