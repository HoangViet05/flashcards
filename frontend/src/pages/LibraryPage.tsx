import { useState } from 'react'

import { getAnkiLibrary } from '../api/anki'
import { createDeck, deleteDeck, getDecks } from '../api/decks'
import { useAuth } from '../auth/AuthContext'
import AnkiLibraryModal from '../components/AnkiLibraryModal'
import DeckCard from '../components/DeckCard'
import ImportAnkiModal from '../components/ImportAnkiModal'
import { useNotification } from '../components/NotificationProvider'
import { useCachedQuery } from '../hooks/useCachedQuery'

const IconImport = () => (
  <svg
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}
    strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"
  >
    <path d="M12 4.5v9" />
    <path d="m8.5 10 3.5 3.5L15.5 10" />
    <path d="M5 16.5v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" />
  </svg>
)

const IconLibrary = () => (
  <svg
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}
    strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"
  >
    <path d="M5 5.5h4v13H5zM11 5.5h3v13h-3zM16.5 6l3 12.5" />
  </svg>
)

export default function LibraryPage() {
  const { user } = useAuth()
  const { toast, confirm } = useNotification()

  const decksQuery = useCachedQuery(user ? `library-v1:${user.id}` : null, getDecks)
  const ankiQuery = useCachedQuery(user ? `anki-library:${user.id}` : null, getAnkiLibrary)
  const decks = decksQuery.data ?? []

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [showAnki, setShowAnki] = useState(false)

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return

    await createDeck({ name: name.trim(), description: description.trim() || undefined })
    toast('Đã tạo bộ thẻ', 'success')
    setName('')
    setDescription('')
    setShowForm(false)
    void decksQuery.refresh()
  }

  const remove = (id: string) => confirm({
    title: 'Xóa bộ thẻ?',
    message: 'Toàn bộ thẻ trong bộ này sẽ bị xóa.',
    confirmText: 'Xóa bộ thẻ',
    variant: 'danger',
    onConfirm: async () => {
      await deleteDeck(id)
      toast('Đã xóa bộ thẻ', 'success')
      await decksQuery.refresh()
    },
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-strong-text">Thư viện của bạn</h1>
          <p className="mt-1 text-sm text-muted">
            {decks.length} bộ thẻ · {decks.reduce((sum, deck) => sum + deck.card_count, 0)} thẻ
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-subtle bg-surface-1 px-4 text-sm font-bold text-body"
          >
            <IconImport />Nhập dữ liệu Anki
          </button>
          <button
            onClick={() => setShowAnki(true)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-subtle bg-surface-1 px-4 text-sm font-bold text-body"
          >
            <IconLibrary />Thư viện Anki{ankiQuery.data?.total ? ` (${ankiQuery.data.total})` : ''}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="min-h-[44px] rounded-xl bg-accent px-4 text-sm font-bold text-white"
          >
            Tạo bộ thẻ
          </button>
        </div>
      </div>

      {decksQuery.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-48 animate-pulse rounded-2xl border border-subtle bg-surface-1" />
          ))}
        </div>
      ) : decks.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck, index) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              cardCount={deck.card_count}
              dueCount={deck.due_count}
              newCount={deck.new_count}
              index={index}
              onDelete={remove}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-subtle bg-surface-1 p-10 text-center">
          <p className="text-lg font-bold text-strong-text">Chưa có bộ thẻ nào</p>
          <p className="mt-1 text-sm text-muted">Tạo một bộ thẻ hoặc lưu từ mới khi đọc bài.</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button aria-label="Đóng" className="absolute inset-0 bg-black/65" onClick={() => setShowForm(false)} />
          <form onSubmit={create} className="relative w-full max-w-md rounded-2xl border border-subtle bg-[#0b0d16] p-6">
            <h2 className="text-xl font-black text-strong-text">Tạo bộ thẻ mới</h2>

            <label className="mt-5 block text-sm font-bold text-body">
              Tên bộ thẻ
              <input
                autoFocus
                value={name}
                onChange={event => setName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-subtle bg-surface-1 px-3 py-3 text-strong-text"
              />
            </label>

            <label className="mt-4 block text-sm font-bold text-body">
              Mô tả (tùy chọn)
              <input
                value={description}
                onChange={event => setDescription(event.target.value)}
                className="mt-2 w-full rounded-xl border border-subtle bg-surface-1 px-3 py-3 text-strong-text"
              />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="min-h-[44px] px-4 text-sm font-bold text-muted">
                Hủy
              </button>
              <button className="min-h-[44px] rounded-xl bg-accent px-5 text-sm font-bold text-white">Lưu bộ thẻ</button>
            </div>
          </form>
        </div>
      )}

      <ImportAnkiModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => { void decksQuery.refresh(); void ankiQuery.refresh() }}
      />
      <AnkiLibraryModal open={showAnki} onClose={() => setShowAnki(false)} onDeleted={() => ankiQuery.refresh()} />
    </div>
  )
}
