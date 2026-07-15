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

  if (!article) {
    return <div className="w-full max-w-3xl px-4 py-8 lg:ml-8 xl:ml-16"><div className="h-64 animate-pulse rounded-2xl bg-white/[.05]" /></div>
  }

  let sentenceIndex = -1
  return (
    <div className="w-full max-w-3xl px-4 py-8 pb-40 lg:ml-8 xl:ml-16">
      <Link to="/reader" className="text-sm text-slate-400 hover:text-cyan-300">← Danh sách bài đọc</Link>
      <h1 className="mt-2 text-2xl font-black text-white">{article.title}</h1>
      <p className="mb-6 mt-1 text-xs text-slate-500">
        {article.word_count} từ {article.source_url && <>· <a href={article.source_url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">nguồn</a></>}
      </p>

      <div className="sticky top-20 z-10 mb-6 flex items-center gap-2 rounded-2xl border border-white/[.07] bg-slate-900/90 p-2 backdrop-blur">
        {tts.playing
          ? <button onClick={stopSpeaking} className="rounded-xl bg-rose-400/10 px-4 py-2 text-sm font-bold text-rose-300">⏹ Dừng</button>
          : <button onClick={() => speakFrom(0)} className="rounded-xl bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-300">▶ Đọc bài</button>}
        <span className="text-xs text-slate-500">Tốc độ:</span>
        {[.75, 1, 1.25].map(value => (
          <button key={value} onClick={() => setRate(value)} className={`rounded-lg px-2 py-1 text-xs font-bold ${rate === value ? 'bg-white/10 text-white' : 'text-slate-500'}`}>
            {value}x
          </button>
        ))}
        <span className="ml-auto hidden text-xs text-slate-500 sm:block">💡 Click từ để tra nghĩa</span>
      </div>

      <article className="space-y-4 text-[17px] leading-8 text-slate-200">
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
      {picked && <WordPopup word={picked.word} sentence={picked.sentence} onClose={() => setPicked(null)} />}
    </div>
  )
}
