import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const output = join(root, 'artifacts', 'visual-qa', 'today-backend-recovery')
const user = { id: 'recovery-user', email: 'recovery@example.test', name: 'Recovery QA', preferred_level: null, created_at: '2026-01-01T00:00:00Z', preferences: null }
const recoveredHome = { new_count: 2, due_count: 3, session_status: 'none', steps_total: 10, steps_done: 5, streak: 7, studied_today: true, mastered_cards: 19, total_cards: 25, deck_count: 2, low_new_words: false, new_remaining: 2, latest_article: null, progression: { streak: 7, study_minutes_today: 11, study_minutes_week: 41, remembered_cards: 19, retention: 0.9, skills: [], heatmap: {}, unlocks: [] }, missions: { daily: [{ id: 'recover-mission', mission_key: 'study_answers', skill: 'vocabulary', target: 5, progress: 3, completed_at: null, rerolled: false }], weekly: [] }, journey: { week_start: '2026-07-20', timezone: 'UTC', boss_available: false, lanes: [{ skill: 'vocabulary', checkpoints: [{ date: '2026-07-20', active: true }, { date: '2026-07-21', active: true }] }] }, server_time: '2026-07-26T18:30:00Z' }

async function setup(page: import('@playwright/test').Page, mode: { delayed?: boolean; failed?: boolean; recovered?: boolean }) {
  await page.addInitScript(({ user }) => { localStorage.setItem('flashcards.auth.token', 'redacted-qa-token'); localStorage.setItem('flashcards.auth.user', JSON.stringify(user)); localStorage.removeItem('swr:today-orbital:recovery-user') }, { user })
  await page.route('**/api/auth/me', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(user) }))
  await page.route('**/api/daily/home', async route => {
    if (mode.delayed) { await new Promise(resolve => setTimeout(resolve, 1800)); return route.fulfill({ contentType: 'application/json', body: JSON.stringify(recoveredHome) }) }
    if (mode.failed && !mode.recovered) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'backend starting' }) })
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(recoveredHome) })
  })
}

test('Today keeps composition during startup, renders an honest API failure, and recovers without reload', async ({ page }) => {
  mkdirSync(output, { recursive: true })
  await page.setViewportSize({ width: 390, height: 844 })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()) })

  await setup(page, { delayed: true })
  await page.goto('/')
  await expect(page.getByText('Starting your learning space…')).toBeVisible()
  await expect(page.locator('.ftd-skeleton-card')).toHaveCount(2)
  await expect(page.getByText('14', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: join(output, 'backend-starting-390.png') })

  await page.reload()
  await setup(page, { failed: true })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible({ timeout: 7000 })
  await expect(page.getByText('Learning service is temporarily unavailable.')).toBeVisible()
  await expect(page.locator('.ftd-core-stats b')).toHaveText(['—', '—', '—'])
  await expect(page.getByText('Unavailable', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: join(output, 'backend-unavailable-390.png') })

  await setup(page, { recovered: true })
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByText('5', { exact: true })).toBeVisible()
  await expect(page.getByText('7 day streak', { exact: true })).toHaveCount(1)
  await expect(page.getByText('11m', { exact: true })).toBeVisible()
  await expect(page.getByText('14', { exact: true })).toHaveCount(0)
  await expect(page.getByText('12 day streak', { exact: true })).toHaveCount(0)
  await expect(page.getByText('18m', { exact: true })).toHaveCount(0)
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).resolves.toBeTruthy()
  await page.screenshot({ path: join(output, 'backend-recovered-390.png') })
  expect(errors).toEqual([])

  writeFileSync(join(output, 'daily-home-response.redacted.json'), `${JSON.stringify(recoveredHome, null, 2)}\n`)
  writeFileSync(join(output, 'result.json'), `${JSON.stringify({ proofFlag: 'unset', startup: 'PASS', failure: 'PASS', recovery: 'PASS', values: { due_count: 3, new_count: 2, streak: 7, study_minutes_today: 11 }, fixtureValuesAbsent: true, consoleErrors: errors, pass: true }, null, 2)}\n`)
})
