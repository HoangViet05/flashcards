import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import WeakWordsPanel from './WeakWordsPanel'
import type { WeakWord } from '../../types'

function word(front: string, wrong: number, total: number): WeakWord {
  return {
    card: { id: front, front_text: front, back_text: 'x' },
    recent_wrong: wrong, total_reviews: total,
    last_step: 'dictation', suggested_step: 'vi_en',
  } as unknown as WeakWord
}

it('offers one action for the whole group', () => {
  render(<MemoryRouter><WeakWordsPanel words={[word('abundant', 3, 5)]} /></MemoryRouter>)
  expect(screen.getByRole('link', { name: /Học ngay/ })).toHaveAttribute('href', '/weak')
})

it('caps the list at eight words', () => {
  const many = Array.from({ length: 14 }, (_, index) => word(`w${index}`, 2, 4))
  render(<MemoryRouter><WeakWordsPanel words={many} /></MemoryRouter>)
  expect(screen.getAllByRole('listitem')).toHaveLength(8)
})

it('invites the learner instead of apologising when nothing is weak', () => {
  render(<MemoryRouter><WeakWordsPanel words={[]} /></MemoryRouter>)
  expect(screen.getByText(/chưa có từ nào/i)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Học ngay/ })).not.toBeInTheDocument()
})
