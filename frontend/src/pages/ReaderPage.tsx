import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getArticle } from '../api/articles'
import WordPopup from '../components/reader/WordPopup'
import type { Article } from '../types'
import { stripTranscriptTimestamps } from '../utils/readerText'

const sentenceParts = (text: string) => text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text]

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

export default function ReaderPage() {
  const { id } = useParams<{ id: string }>()
  const [article, setArticle] = useState<Article | null>(null)
  const [picked, setPicked] = useState<{ word: string; sentence: string } | null>(null)
  const [rate, setRate] = useState(1)
  const [tts, setTts] = useState({ playing: false, sentence: -1 })
  const speechRun = useRef(0)

  useEffect(() => {
    if (id) void getArticle(id).then(setArticle)
    return () => {
      speechRun.current += 1
      window.speechSynthesis.cancel()
    }
  }, [id])

  const content = useMemo(() => stripTranscriptTimestamps(article?.content ?? ''), [article])
  const paragraphs = useMemo(() => content.split(/\n\n+/).filter(Boolean), [content])
  const sentences = useMemo(
    () => paragraphs.flatMap(sentenceParts).map(value => value.trim()).filter(Boolean),
    [paragraphs],
  )

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

    const speak = (index: number) => {
      if (speechRun.current !== run || index >= sentences.length) {
        if (speechRun.current === run) setTts({ playing: false, sentence: -1 })
        return
      }

      setTts({ playing: true, sentence: index })
      const utterance = new SpeechSynthesisUtterance(sentences[index])
      utterance.lang = 'en-US'
      utterance.rate = rate
      utterance.onend = () => {
        if (speechRun.current === run) speak(index + 1)
      }
      utterance.onerror = () => {
        if (speechRun.current === run) setTts({ playing: false, sentence: -1 })
      }
      window.speechSynthesis.speak(utterance)
    }

    speak(start)
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
            <p className="mt-3 rounded-xl bg-white/[.035] px-2.5 py-2 text-[11px] leading-4 text-slate-500">{tts.playing ? `Đang đọc câu ${tts.sentence + 1}/${sentences.length}` : 'Chọn một từ trong bài để tra nghĩa.'}</p>
          </section>
        </aside>

        <article className="min-w-0 max-w-3xl space-y-4 text-[17px] leading-8 text-slate-200">
          {paragraphs.map((paragraph, paragraphIndex) => (
            <p key={paragraphIndex}>
              {sentenceParts(paragraph).map((sentence, childIndex) => {
                sentenceIndex += 1
                const current = sentenceIndex
                return (
                  <span key={childIndex} className={tts.sentence === current ? 'rounded bg-cyan-400/15' : undefined}>
                    {sentence.split(/(\s+)/).map((token, tokenIndex) => {
                      const word = cleanToken(token)
                      return !word || /^\s+$/.test(token)
                        ? token
                        : <span key={tokenIndex} onClick={() => setPicked({ word: word.toLowerCase(), sentence: sentence.trim() })} className="cursor-pointer rounded-sm transition hover:bg-cyan-400/20">{token}</span>
                    })}
                    {' '}
                  </span>
                )
              })}
            </p>
          ))}
        </article>
      </div>
      {picked && <WordPopup word={picked.word} sentence={picked.sentence} onClose={() => setPicked(null)} />}
    </div>
  )
}
