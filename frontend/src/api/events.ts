import client from './client'
export type EventInput = { event_type: 'answer_correct' | 'answer_corrected' | 'reading_complete' | 'shadowing_scored' | 'shadowing_offline' | 'duration' | 'mission_progress'; skill: 'vocabulary' | 'reading' | 'listening' | 'speaking'; idempotency_key: string; duration_seconds?: number; metric_value?: number; source_type?: string; source_id?: string; payload?: Record<string, unknown> }
export const sendEvents = (events: EventInput[]) => client.post('/events/batch', { events }).then(result => result.data)
