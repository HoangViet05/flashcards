import { useEffect, useMemo, useState } from 'react'
import { createArticleCard } from '../../api/articles'
import { lookupEnDictionary, lookupViDictionary } from '../../api/dictionary'
import type { DictionaryResult, EnDictResult } from '../../types'
import { useNotification } from '../NotificationProvider'

interface Props {
  word: string
  sentence: string
  articleId: string
  onClose: () => void
}

function primaryDefinition(content: string) {
  return content.split('\n').find(line => line.trim().startsWith('-'))?.replace(/^\s*-\s*/, '') ?? content.slice(0, 120)
}

function VietnameseDefinition({ content }: { content: string }) {
  return (
    <div className="space-y-1.5 text-[13px] leading-5 text-slate-200">
      {content.split('\n').filter(Boolean).map((rawLine, index) => {
        const line = rawLine.trim()
        if (line.startsWith('*')) {
          return <p key={index} className="pt-2 text-[11px] font-extrabold uppercase tracking-wide text-cyan-200 first:pt-0">{line.replace(/^\*\s*/, '')}</p>
        }
        if (line.startsWith('=')) {
          return <p key={index} className="border-l-2 border-cyan-300/30 pl-2.5 text-[12px] italic leading-5 text-slate-400">{line.slice(1).trim()}</p>
        }
        return <p key={index} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-300/70" /><span>{line.replace(/^-\s*/, '')}</span></p>
      })}
    </div>
  )
}

export default function WordPopup({ word, sentence, articleId, onClose }: Props) {
  const { toast } = useNotification()
  const [vi, setVi] = useState<DictionaryResult | null | 'loading'>('loading')
  const [en, setEn] = useState<EnDictResult | null | 'loading'>('loading')
  const [backText, setBackText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setVi('loading')
    setEn('loading')
    void lookupViDictionary(word).then(result => {
      setVi(result)
      if (result) setBackText(primaryDefinition(result.content))
    })
    void lookupEnDictionary(word).then(setEn)
  }, [word])

  const ipa = useMemo(
    () => vi !== 'loading' && vi?.pronunciation ? vi.pronunciation : en !== 'loading' ? en?.phonetic ?? null : null,
    [vi, en],
  )

  const playAudio = () => {
    if (en !== 'loading' && en?.audioUrl) {
      void new Audio(en.audioUrl).play().catch(() => {})
      return
    }
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = 'en-US'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  const save = async () => {
    if (!backText.trim() || vi === 'loading' || en === 'loading') return
    setSaving(true)
    try {
      await createArticleCard(articleId, {
        word,
        back_text: backText.trim(),
        example_sentence: sentence,
        pronunciation: ipa ?? undefined,
        definition: en?.meanings[0]?.definitions[0],
        audio_url: en?.audioUrl ?? undefined,
      })
      toast(`Saved “${word}” to this reading.`, 'success')
      onClose()
    } catch (error: any) {
      toast(error?.response?.data?.detail ?? 'The learning card could not be saved.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="reader-word-popup fixed inset-3 z-50 sm:inset-auto sm:right-6 sm:top-24 sm:w-[25rem]">
      <div role="dialog" aria-modal="true" aria-label={`Word in context: ${word}`} className="flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-[0_24px_70px_rgba(0,0,0,.48)] sm:max-h-[min(76vh,44rem)]">
        <header className="flex shrink-0 items-start justify-between border-b border-white/[.08] bg-slate-900 px-5 py-4">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[.16em] text-cyan-300/80">Word in context</p>
            <div className="flex items-center gap-2">
              <h3 className="min-w-0 flex-1 truncate text-2xl font-black tracking-tight text-white">{word}</h3>
              <button onClick={playAudio} className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-cyan-300/20 bg-cyan-400/10 text-sm text-cyan-200 transition hover:bg-cyan-400/20" title="Hear pronunciation" aria-label={`Hear pronunciation for ${word}`}>🔊</button>
            </div>
            {ipa && <p className="mt-0.5 text-sm font-medium text-cyan-300">{ipa}</p>}
          </div>
          <button onClick={onClose} className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[.08] hover:text-white" aria-label="Close word details">Close</button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <section className="rounded-xl border border-cyan-300/[.12] bg-cyan-400/[.035] p-3.5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-[11px] font-black uppercase tracking-[.12em] text-cyan-200">Vietnamese meaning</h4>
              {vi !== 'loading' && vi && vi.matched_word !== word && <span className="rounded-md bg-white/[.06] px-1.5 py-0.5 text-[10px] text-slate-400">base: {vi.matched_word}</span>}
            </div>
            {vi === 'loading'
              ? <div className="space-y-2 animate-pulse"><div className="h-3 w-4/5 rounded bg-white/[.08]" /><div className="h-3 w-3/5 rounded bg-white/[.06]" /></div>
              : vi
                ? <VietnameseDefinition content={vi.content} />
                : <p className="text-sm leading-5 text-slate-500">No Vietnamese meaning is available for this word.</p>}
          </section>

          <section className="rounded-xl border border-white/[.08] bg-black/[.13] p-3.5">
            <h4 className="mb-3 text-[11px] font-black uppercase tracking-[.12em] text-slate-400">English</h4>
            {en === 'loading'
              ? <div className="space-y-2 animate-pulse"><div className="h-3 w-full rounded bg-white/[.08]" /><div className="h-3 w-4/5 rounded bg-white/[.06]" /></div>
              : en
                ? <div className="space-y-3">{en.meanings.map((meaning, index) => <div key={index} className="text-[13px] leading-5 text-slate-200"><p className="mb-1 text-xs font-bold text-violet-200">{meaning.partOfSpeech}</p>{meaning.definitions.map((definition, definitionIndex) => <p key={definitionIndex} className="flex gap-2"><span className="text-slate-500">{definitionIndex + 1}.</span><span>{definition}</span></p>)}</div>)}</div>
                : <p className="text-sm text-slate-500">No English definition was found.</p>}
          </section>

          <section className="rounded-xl border border-white/[.06] bg-white/[.025] px-3.5 py-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Context</p>
            <p className="text-xs italic leading-5 text-slate-400">“{sentence}”</p>
          </section>
        </div>

        <footer className="shrink-0 border-t border-white/[.08] bg-slate-950/70 px-4 py-3 backdrop-blur">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Save to this reading's cards</p>
          <div className="space-y-2">
            <input value={backText} onChange={event => setBackText(event.target.value)} placeholder="Meaning for the back of the card" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 transition focus:border-cyan-300/50" />
            <button onClick={() => void save()} disabled={saving || !backText.trim() || vi === 'loading' || en === 'loading'} className="w-full rounded-xl border border-emerald-300/25 bg-emerald-400/10 py-2.5 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-40">{saving ? 'Saving…' : vi === 'loading' || en === 'loading' ? 'Loading pronunciation and voice…' : 'Save to cards'}</button>
          </div>
        </footer>
      </div>
    </div>
  )
}
