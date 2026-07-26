import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getArticle, getArticles } from '../api/articles'
import { getDecks } from '../api/decks'
import { submitReview } from '../api/review'
import { createShadowAttempt, createShadowVideo, deleteShadowVideo, getShadowCards, getShadowVideo, getShadowVideos } from '../api/shadowing'
import { fetchWorkerSubtitles, scoreRecording } from '../api/shadowingWorker'
import { useNotification } from '../components/NotificationProvider'
import ScoreDisplay from '../components/shadowing/ScoreDisplay'
import { Mp3Player, TtsPlayer, type PlayerHandle } from '../components/shadowing/SegmentPlayer'
import VoiceStage from '../components/shadowing/VoiceStage'
import VoiceTrajectory from '../components/shadowing/VoiceTrajectory'
import { YouTubePlayer } from '../components/shadowing/YouTubePlayer'
import { useRecorder } from '../components/shadowing/useRecorder'
import { useShadowingWorker } from '../hooks/useShadowingWorker'
import { useActivityTimer } from '../hooks/useActivityTimer'
import { useAudio } from '../providers/AudioProvider'
import type { ArticleListItem, Deck, ShadowCard, ShadowScore, ShadowVideo, ShadowVideoListItem } from '../types'
import { splitSentences, stripTranscriptTimestamps } from '../utils/readerText'
import '../components/core/CoreExperiences.css'

type Source = { kind: 'card'; cards: ShadowCard[]; label: string } | { kind: 'article'; articleId: string; sentences: string[]; label: string } | { kind: 'youtube'; video: ShadowVideo; label: string }
type Tab = 'card' | 'article' | 'youtube'
type Phase = 'setup' | 'loading' | 'practice' | 'done'
const qualityFor = (score: number) => score >= 80 ? 5 : score >= 60 ? 3 : null

/** The real scoring and review flow, presented inside one stable VoiceStage. */
export default function ShadowingPage() {
  const { toast } = useNotification()
  const worker = useShadowingWorker()
  const recorder = useRecorder()
  const { duckAmbient, stopAmbient } = useAudio()
  const [params] = useSearchParams()
  const playerRef = useRef<PlayerHandle | null>(null)
  const autoStart = useRef(false)
  const [phase, setPhase] = useState<Phase>('setup')
  const [tab, setTab] = useState<Tab>('card')
  const [decks, setDecks] = useState<Deck[]>([])
  const [articles, setArticles] = useState<ArticleListItem[]>([])
  const [videos, setVideos] = useState<ShadowVideoListItem[]>([])
  const [deckScope, setDeckScope] = useState('due')
  const [source, setSource] = useState<Source | null>(null)
  const [index, setIndex] = useState(0)
  const [rate, setRate] = useState(1)
  const [result, setResult] = useState<ShadowScore | null>(null)
  const [scoring, setScoring] = useState(false)
  const [scores, setScores] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({})
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const sentence = useMemo(() => !source ? '' : source.kind === 'card' ? source.cards[index]?.example_sentence ?? '' : source.kind === 'article' ? source.sentences[index] ?? '' : source.video.segments[index]?.text ?? '', [source, index])
  const total = !source ? 0 : source.kind === 'card' ? source.cards.length : source.kind === 'article' ? source.sentences.length : source.video.segments.length
  useActivityTimer({ event_type: 'duration', skill: 'speaking', source_type: 'shadowing' }, phase === 'practice')
  useEffect(() => { if (recorder.recording || scoring) stopAmbient(); else duckAmbient(false) }, [recorder.recording, scoring, duckAmbient, stopAmbient])
  useEffect(() => { void getDecks().then(setDecks).catch(() => {}); void getArticles().then(setArticles).catch(() => {}); void getShadowVideos().then(setVideos).catch(() => {}) }, [])
  const begin = useCallback((next: Source) => { setSource(next); setIndex(0); setScores({}); setSubmitted({}); setResult(null); setPhase('practice') }, [])
  const startCards = useCallback(async (options: { deckId?: string; cardId?: string }) => { setPhase('loading'); try { const cards = await getShadowCards({ ...options, dueOnly: !options.deckId && !options.cardId }); if (!cards.length) { toast('No eligible cards with example audio are available.', 'warning'); setPhase('setup') } else begin({ kind: 'card', cards, label: 'Flashcards' }) } catch { toast('The card source could not be loaded.', 'error'); setPhase('setup') } }, [begin, toast])
  const startArticle = useCallback(async (articleId: string) => { setPhase('loading'); try { const article = await getArticle(articleId); const sentences = splitSentences(stripTranscriptTimestamps(article.content)).filter(value => value.split(/\s+/).length >= 3); if (!sentences.length) throw new Error(); begin({ kind: 'article', articleId, sentences, label: article.title }) } catch { toast('The reading source could not be loaded.', 'error'); setPhase('setup') } }, [begin, toast])
  const startVideo = useCallback(async (id: string) => { setPhase('loading'); try { begin({ kind: 'youtube', video: await getShadowVideo(id), label: 'Video practice' }) } catch { toast('The video source could not be loaded.', 'error'); setPhase('setup') } }, [begin, toast])
  useEffect(() => { if (autoStart.current) return; const card = params.get('card'), deck = params.get('deck'), article = params.get('article'); if (card) { autoStart.current = true; void startCards({ cardId: card }) } else if (deck) { autoStart.current = true; void startCards({ deckId: deck }) } else if (article) { autoStart.current = true; void startArticle(article) } }, [params, startArticle, startCards])
  const flushReview = useCallback((at: number) => { if (!source || source.kind !== 'card' || submitted[at]) return; const quality = scores[at] === undefined ? null : qualityFor(scores[at]); if (quality === null) return; setSubmitted(current => ({ ...current, [at]: true })); void submitReview(source.cards[at].id, { quality, rating_source: 'shadowing', answer_correct: true }).catch(() => toast('The review schedule could not be saved.', 'error')) }, [scores, source, submitted, toast])
  const goTo = (next: number) => { flushReview(index); playerRef.current?.stop(); recorder.reset(); setResult(null); setIndex(next) }
  useEffect(() => { if (!recorder.blob || !sentence || worker.status !== 'online') return; setScoring(true); void scoreRecording(recorder.blob, sentence).then(score => { setResult(score); if (!score.no_speech && source) { setScores(current => ({ ...current, [index]: Math.max(current[index] ?? 0, score.score) })); void createShadowAttempt({ source_type: source.kind, card_id: source.kind === 'card' ? source.cards[index].id : null, article_id: source.kind === 'article' ? source.articleId : null, video_id: source.kind === 'youtube' ? source.video.id : null, segment_index: source.kind === 'card' ? null : index, target_text: sentence, transcript: score.transcript, score: score.score, word_results: score.words }).catch(() => {}) } }).catch(() => toast('The scoring worker did not return a result.', 'error')).finally(() => setScoring(false)) }, [recorder.blob]) // real worker output only
  const importVideo = async () => { if (!youtubeUrl.trim()) return; setImporting(true); try { const video = await createShadowVideo(await fetchWorkerSubtitles(youtubeUrl.trim())); setVideos(await getShadowVideos()); setYoutubeUrl(''); begin({ kind: 'youtube', video, label: video.title }) } catch { toast('The video could not be imported. Check the worker and link.', 'error') } finally { setImporting(false) } }
  const exit = () => { flushReview(index); playerRef.current?.stop(); recorder.reset(); setSource(null); setResult(null); setPhase('setup') }
  const voiceState = worker.status !== 'online' ? 'offline' : scoring ? 'processing' : recorder.recording ? 'recording' : result ? 'score' : 'ready'
  return <main className="shadowing-chamber"><header className="shadowing-chamber__header"><div><p>Voice practice</p><h1>Shadowing chamber</h1></div><span className={worker.status === 'online' ? 'shadowing-status is-ready' : 'shadowing-status'}>{worker.status === 'online' ? 'Scoring worker ready' : 'Scoring unavailable'}</span></header>
    {phase === 'setup' && <section className="voice-source-picker"><div className="voice-source-picker__tabs">{([{ key: 'card', label: 'Flashcards' }, { key: 'article', label: 'Reading' }, { key: 'youtube', label: 'Video' }] as { key: Tab; label: string }[]).map(item => <button key={item.key} onClick={() => setTab(item.key)} data-active={tab === item.key}>{item.label}</button>)}</div>
      {tab === 'card' && <div className="voice-source-picker__panel"><label>Choose a card source<select value={deckScope} onChange={event => setDeckScope(event.target.value)}><option value="due">Due cards today</option>{decks.map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select></label><button onClick={() => void startCards(deckScope === 'due' ? {} : { deckId: deckScope })}>Start voice practice</button></div>}
      {tab === 'article' && <div className="voice-source-picker__list">{articles.map(article => <button key={article.id} onClick={() => void startArticle(article.id)}><b>{article.title}</b><small>{article.word_count} words</small></button>)}</div>}
      {tab === 'youtube' && <div className="voice-source-picker__list"><div className="voice-source-picker__panel"><label>Video URL<input value={youtubeUrl} onChange={event => setYoutubeUrl(event.target.value)} placeholder="https://youtube.com/..." /></label><button disabled={importing || worker.status !== 'online'} onClick={() => void importVideo()}>{importing ? 'Fetching subtitles…' : 'Import video'}</button></div>{videos.map(video => <div key={video.id}><button onClick={() => void startVideo(video.id)}><b>{video.title}</b><small>{video.segment_count} sentences</small></button><button onClick={() => void deleteShadowVideo(video.id).then(() => setVideos(items => items.filter(item => item.id !== video.id)))} aria-label={`Remove ${video.title}`}>Remove</button></div>)}</div>}</section>}
    {phase === 'loading' && <section className="voice-stage" aria-busy="true"><div className="study-skeleton study-skeleton--answer" /><div className="study-skeleton study-skeleton--button" /></section>}
    {phase === 'practice' && source && <VoiceStage state={voiceState} source={source.label} target={sentence}><VoiceTrajectory current={index + 1} total={total} /><div className="voice-player">{source.kind === 'card' && <Mp3Player ref={playerRef} src={source.cards[index].example_audio_url} rate={rate} />}{source.kind === 'article' && <TtsPlayer ref={playerRef} text={sentence} rate={rate} />}{source.kind === 'youtube' && <YouTubePlayer ref={playerRef} videoId={source.video.youtube_id} start={source.video.segments[index].start} end={source.video.segments[index].end} rate={rate} />}</div><div className="voice-actions"><button onClick={() => playerRef.current?.play()}>Listen</button><button onClick={() => setRate(rate === 1 ? .75 : 1)}>{rate}x</button><button disabled={scoring} onClick={() => recorder.recording ? recorder.stop() : void recorder.start()}>{recorder.recording ? 'Stop recording' : 'Record response'}</button></div>{worker.status !== 'online' && <p className="voice-notice">Offline: you can listen and record locally, but no score is shown.</p>}{recorder.error && <p className="voice-notice voice-notice--error">{recorder.error}</p>}{scoring && <div className="study-skeleton study-skeleton--answer" />}{result && !scoring && <ScoreDisplay result={result} />}<div className="voice-next"><button disabled={!index} onClick={() => goTo(index - 1)}>Previous</button><button onClick={() => index + 1 < total ? goTo(index + 1) : (flushReview(index), setPhase('done'))}>{index + 1 < total ? 'Next sentence' : 'Finish practice'}</button><button onClick={exit}>Exit</button></div></VoiceStage>}
    {phase === 'done' && <section className="voice-summary"><p>Practice complete</p><h2>{Object.keys(scores).length} of {total} responses were scored</h2><span>{Object.keys(scores).length ? `${Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length)}% average` : 'No score was available'}</span><button onClick={exit}>Choose another source</button></section>}
  </main>
}
