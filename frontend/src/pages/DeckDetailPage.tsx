import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { createCard, deleteCard, getCards, updateCard } from '../api/cards'
import { getDeck } from '../api/decks'
import { useNotification } from '../components/NotificationProvider'
import type { Card, Deck } from '../types'

export default function DeckDetailPage() {
  const { id } = useParams()
  const { toast, confirm } = useNotification()

  const [deck, setDeck] = useState<Deck | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [example, setExample] = useState('')

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [nextDeck, nextCards] = await Promise.all([getDeck(id), getCards(id)])
      setDeck(nextDeck)
      setCards(nextCards.items)
    } catch {
      toast('Không tải được bộ thẻ', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [id])

  const reset = () => {
    setFront('')
    setBack('')
    setExample('')
    setEditing(null)
    setShowForm(false)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!id || !front.trim() || !back.trim()) return

    const payload = {
      front_text: front.trim(),
      back_text: back.trim(),
      example_sentence: example.trim() || undefined,
    }

    try {
      if (editing) await updateCard(editing, payload)
      else await createCard(id, payload)
      toast(editing ? 'Đã cập nhật thẻ' : 'Đã thêm thẻ mới', 'success')
      reset()
      await load()
    } catch {
      toast('Không lưu được thẻ', 'error')
    }
  }

  const edit = (card: Card) => {
    setEditing(card.id)
    setFront(card.front_text)
    setBack(card.back_text)
    setExample(card.example_sentence || '')
    setShowForm(true)
  }

  const remove = (card: Card) => confirm({
    title: 'Xóa thẻ?',
    message: `Xóa “${card.front_text}” khỏi bộ thẻ này.`,
    confirmText: 'Xóa thẻ',
    variant: 'danger',
    onConfirm: async () => {
      await deleteCard(card.id)
      toast('Đã xóa thẻ', 'success')
      await load()
    },
  })

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  if (!deck) {
    return <div className="mx-auto max-w-5xl px-4 py-12 text-muted">Không tìm thấy bộ thẻ.</div>
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <Link to="/library" className="text-sm font-bold text-accent-2 underline">Về thư viện</Link>

      <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-subtle bg-surface-1 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-strong-text">{deck.name}</h1>
          {deck.description && <p className="mt-1 text-sm text-muted">{deck.description}</p>}
          <p className="mt-3 text-sm text-muted">
            {cards.length} thẻ · {deck.new_count} từ mới · {deck.due_count} cần ôn
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            to="/daily"
            className="inline-flex min-h-[44px] items-center rounded-xl border border-subtle bg-surface-2 px-4 text-sm font-bold text-body"
          >
            Học hôm nay
          </Link>
          <button
            onClick={() => { reset(); setShowForm(true) }}
            className="min-h-[44px] rounded-xl bg-accent px-4 text-sm font-bold text-white"
          >
            Thêm thẻ
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {cards.map(card => (
          <article key={card.id} className="rounded-2xl border border-subtle bg-surface-1 p-5">
            <div className="flex gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-black text-strong-text">{card.front_text}</h2>
                <p className="mt-1 text-body">{card.back_text}</p>
                {card.example_sentence && (
                  <p className="mt-3 border-l-2 border-accent pl-3 text-sm italic text-muted">{card.example_sentence}</p>
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => edit(card)}
                  className="min-h-[36px] rounded-lg border border-subtle bg-surface-2 px-3 text-xs font-bold text-body"
                >
                  Sửa
                </button>
                <button
                  onClick={() => remove(card)}
                  className="min-h-[36px] rounded-lg border border-wrong/30 bg-wrong/10 px-3 text-xs font-bold text-wrong"
                >
                  Xóa
                </button>
              </div>
            </div>
          </article>
        ))}

        {cards.length === 0 && (
          <p className="rounded-2xl border border-subtle bg-surface-1 p-8 text-center text-muted">
            Bộ thẻ này chưa có thẻ nào.
          </p>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button className="absolute inset-0 bg-black/65" aria-label="Đóng" onClick={reset} />
          <form onSubmit={save} className="relative w-full max-w-lg rounded-2xl border border-subtle bg-[#0b0d16] p-6">
            <h2 className="text-xl font-black text-strong-text">{editing ? 'Sửa thẻ' : 'Thêm thẻ mới'}</h2>

            <label className="mt-5 block text-sm font-bold text-body">
              Mặt trước
              <input
                autoFocus
                value={front}
                onChange={event => setFront(event.target.value)}
                className="mt-2 w-full rounded-xl border border-subtle bg-surface-1 px-3 py-3 text-strong-text"
              />
            </label>

            <label className="mt-4 block text-sm font-bold text-body">
              Mặt sau
              <input
                value={back}
                onChange={event => setBack(event.target.value)}
                className="mt-2 w-full rounded-xl border border-subtle bg-surface-1 px-3 py-3 text-strong-text"
              />
            </label>

            <label className="mt-4 block text-sm font-bold text-body">
              Ví dụ (tùy chọn)
              <textarea
                value={example}
                onChange={event => setExample(event.target.value)}
                className="mt-2 w-full rounded-xl border border-subtle bg-surface-1 px-3 py-3 text-strong-text"
              />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={reset} className="min-h-[44px] px-4 text-sm font-bold text-muted">
                Hủy
              </button>
              <button className="min-h-[44px] rounded-xl bg-accent px-5 text-sm font-bold text-white">Lưu thẻ</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
