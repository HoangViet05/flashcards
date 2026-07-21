import { useEffect, useState } from 'react'
import type { Card, ExerciseStep } from '../../types'
import { playCardAudio } from '../../utils/audio'

interface Props { card: Card; mode: ExerciseStep; onResult: (correct: boolean) => void }
const normalizeEn = (value: string) => value.trim().toLowerCase().replace(/[.,!?;:()[\]{}"']/g, '').replace(/\s+/g, ' ')
const normalizeVi = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')
const prompts: Record<ExerciseStep, string> = { dictation: '🎧 Nghe và gõ lại từ', vi_en: '🇻🇳→🇬🇧 Gõ từ tiếng Anh', en_vi: '🇬🇧→🇻🇳 Gõ nghĩa tiếng Việt' }

export default function ExerciseCard({ card, mode, onResult }: Props) {
  const [typed, setTyped] = useState(''); const [state, setState] = useState<'answering' | 'wrong' | 'self_confirm'>('answering')
  useEffect(() => { setTyped(''); setState('answering'); if (mode === 'dictation') playCardAudio(card); return () => window.speechSynthesis.cancel() }, [card.id, mode])
  const check = () => {
    if (mode === 'en_vi') {
      const answer = normalizeVi(typed), expected = normalizeVi(card.back_text)
      if (answer.length >= 2 && (expected.includes(answer) || answer.includes(expected))) onResult(true); else setState('self_confirm')
    } else if (normalizeEn(typed) === normalizeEn(card.front_text)) onResult(true); else setState('wrong')
  }
  const answer = mode === 'en_vi' ? card.back_text : card.front_text
  return <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-5">
    <p className="mb-3 text-xs font-black uppercase text-slate-500">{prompts[mode]}</p>
    {mode === 'dictation' && <button onClick={() => playCardAudio(card)} className="mb-4 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200">🔊 Nghe lại</button>}
    {mode === 'vi_en' && <p className="mb-4 rounded-xl bg-black/25 p-3 text-slate-200">{card.back_text}</p>}
    {mode === 'en_vi' && <p className="mb-4 flex items-center gap-3 rounded-xl bg-black/25 p-3 text-slate-200"><b>{card.front_text}</b><button onClick={() => playCardAudio(card)}>🔊</button></p>}
    {state === 'answering' && <><input autoFocus value={typed} onChange={event => setTyped(event.target.value)} onKeyDown={event => event.key === 'Enter' && typed.trim() && check()} placeholder={mode === 'en_vi' ? 'Gõ nghĩa tiếng Việt...' : 'Gõ từ tiếng Anh...'} className="mb-4 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-white" /><button disabled={!typed.trim()} onClick={check} className="w-full rounded-xl border border-emerald-300/25 bg-emerald-400/10 py-2.5 text-sm font-bold text-emerald-200 disabled:opacity-40">Kiểm tra</button></>}
    {state === 'wrong' && <div><p className="mb-2 text-sm text-rose-300">Chưa đúng. Đáp án:</p><p className="mb-4 rounded-xl bg-black/25 p-3 font-bold text-emerald-300">{answer}</p><button onClick={() => onResult(false)} className="w-full rounded-xl border border-white/10 bg-white/[.05] py-2.5 text-sm font-bold text-slate-200">Tiếp tục</button></div>}
    {state === 'self_confirm' && <div><p className="mb-2 text-sm text-slate-300">Đáp án trong thẻ:</p><p className="mb-4 rounded-xl bg-black/25 p-3 font-bold text-emerald-300">{card.back_text}</p><p className="mb-3 text-sm text-slate-400">Câu trả lời của bạn: “{typed}” — bạn có đúng không?</p><div className="flex gap-2"><button onClick={() => onResult(true)} className="flex-1 rounded-xl border border-emerald-300/25 bg-emerald-400/10 py-2.5 text-sm font-bold text-emerald-200">✅ Tôi đúng</button><button onClick={() => onResult(false)} className="flex-1 rounded-xl border border-rose-300/25 bg-rose-400/10 py-2.5 text-sm font-bold text-rose-200">❌ Tôi sai</button></div></div>}
  </div>
}
