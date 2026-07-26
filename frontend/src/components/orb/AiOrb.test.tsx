import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import AiOrb from './AiOrb'

it('announces a meaningful loading state', () => {
  render(<AiOrb state="loading" />)
  expect(screen.getByText('Starting your learning space…')).toBeInTheDocument()
})
