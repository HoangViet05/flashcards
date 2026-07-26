import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const output = join(root, 'artifacts', 'visual-qa', 'today-production-refinement')
const user = { id: 'today-refine-user', email: 'today-refine@example.test', name: 'Today QA', preferred_level: null, created_at: '2026-01-01T00:00:00Z', preferences: null }
const home = { new_count: 2, due_count: 3, session_status: 'none', steps_total: 10, steps_done: 5, streak: 7, studied_today: true, mastered_cards: 19, total_cards: 25, deck_count: 2, low_new_words: false, new_remaining: 2, latest_article: null, progression: { streak: 7, study_minutes_today: 11, study_minutes_week: 41, remembered_cards: 19, retention: 0.9, skills: [{ skill: 'vocabulary', xp: 52, level: 3, mastery: 52, building_signal: false }, { skill: 'reading', xp: 31, level: 2, mastery: 31, building_signal: false }], heatmap: {}, unlocks: [] }, missions: { daily: [{ id: 'mission-study', mission_key: 'study_answers', skill: 'vocabulary', target: 5, progress: 3, completed_at: null, rerolled: false }, { id: 'mission-read', mission_key: 'reading_minutes', skill: 'reading', target: 10, progress: 4, completed_at: null, rerolled: false }, { id: 'mission-speak', mission_key: 'shadowing', skill: 'speaking', target: 4, progress: 1, completed_at: null, rerolled: false }], weekly: [] }, journey: { week_start: '2026-07-20', timezone: 'UTC', boss_available: false, lanes: [{ skill: 'vocabulary', checkpoints: [{ date: '2026-07-20', active: true }, { date: '2026-07-21', active: true }, { date: '2026-07-22', active: false }, { date: '2026-07-23', active: false }, { date: '2026-07-24', active: false }] }] }, server_time: '2026-07-26T18:30:00Z' }

async function setup(page: import('@playwright/test').Page, theme: 'light' | 'dark', reduceEffects = false) {
  await page.addInitScript(({ user, theme, reduceEffects }) => { localStorage.setItem('flashcards.auth.token', 'redacted-qa-token'); localStorage.setItem('flashcards.auth.user', JSON.stringify(user)); localStorage.setItem('flashie.appearance', JSON.stringify({ theme, accent: 'violet-cyan', reduceEffects })); localStorage.removeItem('swr:today-orbital:today-refine-user') }, { user, theme, reduceEffects })
  await page.route('**/api/auth/me', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(user) }))
  await page.route('**/api/daily/home', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(home) }))
}

test('Today refinement visual, motion, accessibility, and interaction gates', async ({ browser }) => {
  mkdirSync(output, { recursive: true })
  const results: Record<string, unknown> = {}
  for (const [name, viewport, theme] of [
    ['desktop-1920-light', { width: 1920, height: 1080 }, 'light'], ['desktop-1920-dark', { width: 1920, height: 1080 }, 'dark'],
    ['desktop-1440-light', { width: 1440, height: 900 }, 'light'], ['desktop-1440-dark', { width: 1440, height: 900 }, 'dark'],
    ['mobile-390-light', { width: 390, height: 844 }, 'light'], ['mobile-390-dark', { width: 390, height: 844 }, 'dark'],
  ] as const) {
    const context = await browser.newContext({ viewport }); const page = await context.newPage(); const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()) })
    await setup(page, theme); await page.goto('/'); await expect(page.locator('[data-testid="today-orbital-command"]')).toBeVisible(); await expect(page.locator('.ai-orb')).toHaveCount(1)
    const geometry = await page.evaluate(() => { const lower = document.querySelector<HTMLElement>('.ftd-lower-grid')!.getBoundingClientRect(); const nav = document.querySelector<HTMLElement>('.ftd-mobile-nav')?.getBoundingClientRect(); return { overflow: document.documentElement.scrollWidth > innerWidth, lowerBottom: Math.round(lower.bottom), viewportHeight: innerHeight, mobileClear: !nav || lower.top < nav.top } })
    expect(geometry.overflow).toBeFalsy(); if (viewport.width > 640) expect(geometry.lowerBottom).toBeGreaterThanOrEqual(viewport.height - 40); if (viewport.width <= 640) expect(geometry.mobileClear).toBeTruthy()
    await page.screenshot({ path: join(output, `${name}.png`), fullPage: viewport.width <= 640 })
    results[name] = { ...geometry, consoleErrors: errors, pass: errors.length === 0 }
    expect(errors).toEqual([]); await context.close()
  }

  const motionContext = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const motionPage = await motionContext.newPage(); await setup(motionPage, 'light'); await motionPage.goto('/'); await expect(motionPage.locator('.ai-orb')).toBeVisible()
  const firstTransform = await motionPage.locator('.ai-orb__orbit').first().evaluate(element => getComputedStyle(element).transform); await motionPage.waitForTimeout(700); const secondTransform = await motionPage.locator('.ai-orb__orbit').first().evaluate(element => getComputedStyle(element).transform)
  expect(firstTransform).not.toBe(secondTransform); await motionPage.screenshot({ path: join(output, 'orb-motion-frame-1.png') }); await motionPage.waitForTimeout(700); await motionPage.screenshot({ path: join(output, 'orb-motion-frame-2.png') })
  await motionPage.getByRole('button', { name: 'Show today’s learning status' }).click(); await expect(motionPage.getByText('5 words are ready for your current daily plan.')).toBeVisible()
  await expect(motionPage.locator('.ftd-metric-link').nth(0)).toHaveAttribute('href', '/daily'); await expect(motionPage.locator('.ftd-metric-link').nth(1)).toHaveAttribute('href', '/stats'); await expect(motionPage.locator('.ftd-mission').nth(0)).toHaveAttribute('href', '/daily'); await expect(motionPage.locator('.ftd-mission').nth(1)).toHaveAttribute('href', '/reader'); await expect(motionPage.locator('.ftd-mission').nth(2)).toHaveAttribute('href', '/shadowing'); await motionPage.locator('.ftd-mission').first().focus(); await expect(motionPage.locator('.ftd-mission').first()).toBeFocused(); await motionPage.locator('.ftd-week-path button').first().press('Enter'); await expect(motionPage.getByText(/MON: completed/)).toBeVisible(); await motionContext.close()

  const reducedContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); const reducedPage = await reducedContext.newPage(); await setup(reducedPage, 'dark', true); await reducedPage.goto('/'); const reduced = await reducedPage.locator('.ai-orb__orbit').first().evaluate(element => getComputedStyle(element).animationName); expect(reduced).toBe('none'); await reducedPage.screenshot({ path: join(output, 'desktop-1440-dark-reduced-motion.png') }); await reducedContext.close()
  writeFileSync(join(output, 'result.json'), `${JSON.stringify({ proofFlag: 'unset', visualStates: results, orbMotion: { firstTransform, secondTransform, pass: firstTransform !== secondTransform }, reducedMotion: 'PASS', routes: { words: '/daily', remembered: '/stats', vocabulary: '/daily', reading: '/reader', speaking: '/shadowing' }, pass: true }, null, 2)}\n`)
})
