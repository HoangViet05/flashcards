import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { deleteArticleHighlight, getArticle, getArticleHighlights, getArticleTranslation, saveArticleHighlight } from '../api/articles'
import { lookupViDictionary } from '../api/dictionary'
import WordPopup from '../components/reader/WordPopup'
import type { Article, ArticleHighlight, ArticleTranslation } from '../types'
import { stripTranscriptTimestamps } from '../utils/readerText'

const sentenceParts = (text: string) => text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text]

const VOICE_STORAGE_KEY = 'reader-speech-voice'
const SPEECH_CHUNK_LENGTH = 360
type ReaderLanguage = 'original' | 'bilingual' | 'translated'

type SpeechChunk = {
  text: string
  startSentence: number
  sentenceOffsets: number[]
}

// Reading a short group of sentences per utterance reduces the artificial gap
// between sentences without making individual browser utterances too long.
function makeSpeechChunks(sentences: string[]): SpeechChunk[] {
  const chunks: SpeechChunk[] = []
  let buffer: string[] = []
  let startSentence = 0
  let length = 0

  const flush = () => {
    if (!buffer.length) return
    let offset = 0
    const sentenceOffsets = buffer.map((sentence, index) => {
      if (index) offset += 1
      const result = offset
      offset += sentence.length
      return result
    })
    chunks.push({ text: buffer.join(' '), startSentence, sentenceOffsets })
    startSentence += buffer.length
    buffer = []
    length = 0
  }

  for (const sentence of sentences) {
    const addition = sentence.length + (buffer.length ? 1 : 0)
    if (buffer.length && length + addition > SPEECH_CHUNK_LENGTH) flush()
    buffer.push(sentence)
    length += sentence.length + (buffer.length > 1 ? 1 : 0)
  }
  flush()
  return chunks
}

export function extractSentence(paragraph: string, charIndex: number): string {
  const parts = sentenceParts(paragraph)
  let position = 0
  for (const sentence of parts) {
    position += sentence.length
    if (charIndex < position) return sentence.trim()
  }
  return parts[parts.length - 1]?.trim() ?? paragraph
}

const cleanToken = (token: string) => token.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '')

const shortVietnameseMeaning = (content: string) => (
  content.split('\n').find(line => line.trim().startsWith('-'))?.replace(/^\s*-\s*/, '')
  ?? content.split('\n').find(line => line.trim() && !line.trim().startsWith('*') && !line.trim().startsWith('='))?.trim()
  ?? 'Chưa có nghĩa Việt'
)

function HighlightPanel({ highlights, onRemove }: { highlights: ArticleHighlight[]; onRemove: (word: string) => void }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-amber-300/[.16] bg-slate-950/80 shadow-[0_18px_45px_rgba(0,0,0,.22)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/[.07] px-4 py-3">
        <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-300/20 bg-amber-300/10 text-sm text-amber-200">✦</span><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-amber-200/85">Từ cần nhớ</p><p className="text-xs font-bold text-slate-200">Đánh dấu trong bài</p></div></div>
        <span className="rounded-full bg-white/[.07] px-2 py-0.5 text-xs font-bold text-slate-400">{highlights.length}</span>
      </div>
      {highlights.length
        ? <div className="max-h-[min(55dvh,32rem)] divide-y divide-white/[.06] overflow-y-auto px-2 py-2">{highlights.map(highlight => <div key={highlight.id} className="group flex gap-2 rounded-xl px-2 py-2.5 transition hover:bg-white/[.04]"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-sm bg-amber-300/70" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-amber-100">{highlight.word}</p><p className="mt-0.5 text-xs leading-4 text-slate-400">{highlight.meaning ?? 'Đang tra nghĩa Việt…'}</p></div><button onClick={() => onRemove(highlight.word)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-600 opacity-100 transition hover:bg-rose-400/10 hover:text-rose-300 sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Bỏ đánh dấu ${highlight.word}`}>×</button></div>)}</div>
        : <div className="px-4 py-5"><p className="text-sm font-semibold text-slate-300">Chưa có từ nào</p><p className="mt-1 text-xs leading-5 text-slate-500">Nháy đúp vào một từ trong bài để đánh dấu và lưu nghĩa Việt ngắn gọn ở đây.</p></div>}
    </section>
  )
}

export default function ReaderPage() {
  const { id } = useParams<{ id: string }>()
  const [article, setArticle] = useState<Article | null>(null)
  const [translation, setTranslation] = useState<ArticleTranslation | null>(null)
  const [readerLanguage, setReaderLanguage] = useState<ReaderLanguage>('original')
  const [highlights, setHighlights] = useState<ArticleHighlight[]>([])
  const [picked, setPicked] = useState<{ word: string; sentence: string } | null>(null)
  const [rate, setRate] = useState(1)
  const [tts, setTts] = useState({ playing: false, sentence: -1 })
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceURI, setVoiceURI] = useState(() => window.localStorage.getItem(VOICE_STORAGE_KEY) ?? '')
  const speechRun = useRef(0)
  const wordClickTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  useEffect(() => {
    if (id) {
      void getArticle(id).then(setArticle)
      void getArticleHighlights(id).then(setHighlights).catch(() => setHighlights([]))
      void getArticleTranslation(id).then(setTranslation).catch(() => setTranslation(null))
    }
    return () => {
      speechRun.current += 1
      window.speechSynthesis.cancel()
      if (wordClickTimer.current) window.clearTimeout(wordClickTimer.current)
    }
  }, [id])

  const content = useMemo(() => stripTranscriptTimestamps(article?.content ?? ''), [article])
  const paragraphs = useMemo(() => content.split(/\n\n+/).filter(Boolean), [content])
  const sentences = useMemo(
    () => paragraphs.flatMap(sentenceParts).map(value => value.trim()).filter(Boolean),
    [paragraphs],
  )
  const chunks = useMemo(() => makeSpeechChunks(sentences), [sentences])
  const hasTranslation = translation?.status === 'completed' && Boolean(translation.translated_content)
  const translatedParagraphs = useMemo(
    () => (translation?.translated_content ?? '').split(/\n\n+/).map(value => value.trim()).filter(Boolean),
    [translation],
  )
  const availableVoices = useMemo(() => {
    const englishVoices = voices.filter(voice => /^en(?:-|_)/i.test(voice.lang))
    return englishVoices.length ? englishVoices : voices
  }, [voices])
  const selectedVoice = useMemo(
    () => availableVoices.find(voice => voice.voiceURI === voiceURI),
    [availableVoices, voiceURI],
  )

  useEffect(() => {
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices())
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [])

  const stopSpeaking = () => {
    // Some browsers emit onend after cancel(). Invalidate that sequence first.
    speechRun.current += 1
    window.speechSynthesis.cancel()
    setTts({ playing: false, sentence: -1 })
  }

  const speakFrom = (start: number) => {
    const run = speechRun.current + 1
    speechRun.current = run
    window.speechSynthesis.cancel()

    const startChunk = Math.max(0, chunks.findIndex(chunk => start >= chunk.startSentence && start < chunk.startSentence + chunk.sentenceOffsets.length))

    const speak = (chunkIndex: number) => {
      if (speechRun.current !== run || chunkIndex >= chunks.length) {
        if (speechRun.current === run) setTts({ playing: false, sentence: -1 })
        return
      }

      const chunk = chunks[chunkIndex]
      setTts({ playing: true, sentence: chunk.startSentence })
      const utterance = new SpeechSynthesisUtterance(chunk.text)
      utterance.lang = selectedVoice?.lang || 'en-US'
      if (selectedVoice) utterance.voice = selectedVoice
      utterance.rate = rate
      utterance.onboundary = event => {
        if (speechRun.current !== run || typeof event.charIndex !== 'number') return
        let sentenceOffset = 0
        for (let index = 0; index < chunk.sentenceOffsets.length; index += 1) {
          if (event.charIndex >= chunk.sentenceOffsets[index]) sentenceOffset = index
          else break
        }
        setTts({ playing: true, sentence: chunk.startSentence + sentenceOffset })
      }
      utterance.onend = () => {
        if (speechRun.current === run) speak(chunkIndex + 1)
      }
      utterance.onerror = () => {
        if (speechRun.current === run) setTts({ playing: false, sentence: -1 })
      }
      window.speechSynthesis.speak(utterance)
    }

    speak(startChunk)
  }

  const selectVoice = (nextVoiceURI: string) => {
    if (tts.playing) stopSpeaking()
    setVoiceURI(nextVoiceURI)
    if (nextVoiceURI) window.localStorage.setItem(VOICE_STORAGE_KEY, nextVoiceURI)
    else window.localStorage.removeItem(VOICE_STORAGE_KEY)
  }

  const openWordPopup = (word: string, sentence: string) => {
    if (wordClickTimer.current) window.clearTimeout(wordClickTimer.current)
    wordClickTimer.current = window.setTimeout(() => {
      setPicked({ word, sentence })
      wordClickTimer.current = null
    }, 180)
  }

  const removeHighlight = (word: string) => {
    if (!article) return
    const previous = highlights
    setHighlights(current => current.filter(highlight => highlight.word !== word))
    void deleteArticleHighlight(article.id, word).catch(() => setHighlights(previous))
  }

  const toggleHighlight = (word: string) => {
    if (!article) return
    if (wordClickTimer.current) {
      window.clearTimeout(wordClickTimer.current)
      wordClickTimer.current = null
    }
    const existing = highlights.find(highlight => highlight.word === word)
    if (existing) {
      removeHighlight(word)
      return
    }

    const temporary: ArticleHighlight = { id: `pending-${word}`, word, meaning: null, created_at: new Date().toISOString() }
    setHighlights(current => [temporary, ...current])
    void lookupViDictionary(word)
      .then(result => saveArticleHighlight(article.id, word, result ? shortVietnameseMeaning(result.content) : 'Chưa có nghĩa Việt'))
      .then(saved => setHighlights(current => current.map(highlight => highlight.id === temporary.id ? saved : highlight)))
      .catch(() => setHighlights(current => current.filter(highlight => highlight.id !== temporary.id)))
  }

  if (!article) return <div className="mx-auto max-w-3xl px-4 py-8"><div className="h-64 animate-pulse rounded-2xl bg-white/[.05]" /></div>

  let sentenceIndex = -1
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-40 sm:px-6">
      <header className="mx-auto max-w-3xl lg:ml-60">
        <Link to="/reader" className="text-sm text-slate-400 hover:text-cyan-300">← Danh sách bài đọc</Link>
        <h1 className="mt-2 text-2xl font-black text-white">{article.title}</h1>
        <p className="mb-6 mt-1 text-xs text-slate-500">
          {article.word_count} từ {article.source_url && <>· <a href={article.source_url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">nguồn</a></>}
        </p>
      </header>

      <aside className="fixed left-6 top-36 z-10 hidden w-80 min-[1800px]:block">
        <HighlightPanel highlights={highlights} onRemove={removeHighlight} />
      </aside>

      <div className="grid items-start gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-8">
        <aside className="z-10 lg:sticky lg:top-24">
          <section className="rounded-2xl border border-cyan-300/[.12] bg-slate-950/70 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-400/10 text-sm text-cyan-300">◖</span>
              <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-cyan-300/80">Audio reader</p><p className="text-xs font-bold text-slate-200">Nghe bài viết</p></div>
            </div>
            {tts.playing
              ? <button onClick={stopSpeaking} className="w-full rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2.5 text-sm font-bold text-rose-200 transition hover:bg-rose-400/15">⏹ Dừng đọc</button>
              : <button onClick={() => speakFrom(0)} className="w-full rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2.5 text-sm font-bold text-cyan-200 transition hover:bg-cyan-400/15">▶ Đọc từ đầu</button>}
            <div className="mt-3 border-t border-white/[.07] pt-3">
              <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[.12em] text-slate-500">Tốc độ đọc</p>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/20 p-1">
                {[.75, 1, 1.25].map(value => <button key={value} onClick={() => setRate(value)} className={`rounded-lg px-1 py-2 text-xs font-bold transition ${rate === value ? 'bg-white/[.12] text-white shadow-sm' : 'text-slate-500 hover:bg-white/[.05] hover:text-slate-300'}`}>{value}x</button>)}
              </div>
            </div>
            {hasTranslation && <div className="mt-3 border-t border-white/[.07] pt-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[10px] font-black uppercase tracking-[.12em] text-emerald-300/85">Bản dịch</p>
                <span className="rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">Sẵn sàng</span>
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/20 p-1">
                {([
                  ['original', 'Anh'],
                  ['bilingual', 'Anh–Việt'],
                  ['translated', 'Việt'],
                ] as const).map(([value, label]) => <button key={value} onClick={() => setReaderLanguage(value)} className={`rounded-lg px-1 py-2 text-[10px] font-bold transition ${readerLanguage === value ? 'bg-emerald-400/15 text-emerald-100 shadow-sm' : 'text-slate-500 hover:bg-white/[.05] hover:text-slate-300'}`}>{label}</button>)}
              </div>
              <p className="mt-1.5 px-1 text-[10px] leading-4 text-slate-600">Chọn Anh–Việt để đối chiếu từng đoạn.</p>
            </div>}
            <div className="mt-3 border-t border-white/[.07] pt-3">
              <label htmlFor="reader-voice" className="mb-2 block px-1 text-[10px] font-black uppercase tracking-[.12em] text-slate-500">Giọng đọc</label>
              <select id="reader-voice" value={selectedVoice?.voiceURI ?? ''} onChange={event => selectVoice(event.target.value)} className="w-full truncate rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 text-xs font-medium text-slate-200 outline-none transition focus:border-cyan-300/50" title="Giọng đọc có sẵn trên thiết bị">
                <option value="">Mặc định của trình duyệt</option>
                {availableVoices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}
              </select>
              <p className="mt-1.5 px-1 text-[10px] leading-4 text-slate-600">{voices.length ? 'Danh sách giọng do thiết bị của bạn cung cấp.' : 'Đang tải các giọng có sẵn…'}</p>
            </div>
            <p className="mt-3 rounded-xl bg-white/[.035] px-2.5 py-2 text-[11px] leading-4 text-slate-500">{tts.playing ? `Đang đọc câu ${tts.sentence + 1}/${sentences.length}` : 'Chọn một từ trong bài để tra nghĩa.'}</p>
          </section>
          <div className="mt-4 min-[1800px]:hidden">
            <HighlightPanel highlights={highlights} onRemove={removeHighlight} />
          </div>
        </aside>

        <article className="min-w-0 max-w-3xl space-y-4 text-[17px] leading-8 text-slate-200">
          {readerLanguage === 'translated' ? translatedParagraphs.map((paragraph, paragraphIndex) => (
            <p key={paragraphIndex} className="rounded-xl border border-emerald-300/[.08] bg-emerald-400/[.035] px-4 py-3 text-slate-100">{paragraph}</p>
          )) : readerLanguage === 'original' && paragraphs.map((paragraph, paragraphIndex) => (
            <p key={paragraphIndex}>
              {sentenceParts(paragraph).map((sentence, childIndex) => {
                sentenceIndex += 1
                const current = sentenceIndex
                return (
                  <span key={childIndex} className={tts.sentence === current ? 'rounded bg-cyan-400/15' : undefined}>
                    {sentence.split(/(\s+)/).map((token, tokenIndex) => {
                      const word = cleanToken(token)
                      const normalizedWord = word.toLowerCase()
                      const isHighlighted = highlights.some(highlight => highlight.word === normalizedWord)
                      return !word || /^\s+$/.test(token)
                        ? token
                        : <span key={tokenIndex} onClick={() => openWordPopup(normalizedWord, sentence.trim())} onDoubleClick={event => { event.preventDefault(); toggleHighlight(normalizedWord) }} className={`cursor-pointer rounded-sm transition hover:bg-cyan-400/20 ${isHighlighted ? 'bg-amber-300/20 px-0.5 font-semibold text-amber-100 shadow-[inset_0_-2px_0_rgba(252,211,77,.72)] hover:bg-amber-300/30' : ''}`}>{token}</span>
                    })}
                    {' '}
                  </span>
                )
              })}
            </p>
          ))}
          {readerLanguage === 'bilingual' && translation?.segments?.map((segment, index) => (
            <section key={`${segment.source}-${index}`} className="rounded-xl border border-emerald-300/[.10] bg-emerald-400/[.035] px-4 py-3 text-[15px] leading-7">
              <p className="text-slate-300">{segment.source}</p>
              <p className="mt-2 border-t border-emerald-300/[.10] pt-2 font-medium text-emerald-100">{segment.translated}</p>
            </section>
          ))}
        </article>
      </div>
      {picked && <WordPopup word={picked.word} sentence={picked.sentence} onClose={() => setPicked(null)} />}
    </div>
  )
}
