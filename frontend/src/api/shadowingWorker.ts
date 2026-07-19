import axios from 'axios'
import type { ShadowScore, ShadowSegment } from '../types'
export const WORKER_BASE_URL = (import.meta.env.VITE_SHADOWING_WORKER_URL || 'http://127.0.0.1:8788').replace(/\/+$/, '')
const worker = axios.create({ baseURL: WORKER_BASE_URL })
export interface WorkerHealth { status: string; model: string; model_loaded: boolean; device: 'cuda' | 'cpu' | null }
export interface WorkerSubtitles { youtube_id: string; title: string; duration_s: number | null; segments: ShadowSegment[] }
export const getWorkerHealth = () => worker.get<WorkerHealth>('/health', { timeout: 3000 }).then(response => response.data)
export const scoreRecording = (blob: Blob, targetText: string) => { const form = new FormData(); form.append('file', blob, 'recording.webm'); form.append('target_text', targetText); return worker.post<ShadowScore>('/score', form, { timeout: 120000 }).then(response => response.data) }
export const fetchWorkerSubtitles = (url: string) => worker.get<WorkerSubtitles>('/subtitles', { params: { url }, timeout: 60000 }).then(response => response.data)
