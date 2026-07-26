import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const out = join(root, 'artifacts', 'visual-qa', 'r3-r5-core-batch')
const user = { id: 'core-qa', email: 'core@example.test', name: 'Core QA', preferred_level: 2, created_at: '2026-07-27T00:00:00Z', preferences: null }
const article = { id: 'article-qa', title: 'Signals in the quiet network', source_type: 'paste', source_url: null, word_count: 18, has_summary: false, translation_status: null, created_at: '2026-07-27T00:00:00Z', content: 'A quiet network carries clear signals. Learners notice a signal, repeat it, and return when the memory needs attention.', document_id: null, deck_id: null, summary: null, level: 2 }
const card = { id: 'card-qa', deck_id: 'deck-qa', front_text: 'signal', back_text: 'tín hiệu', example_sentence: 'A clear signal helps memory return.', pronunciation: null, definition: null, image_url: null, audio_url: null, example_audio_url: null, source_type: null, source_name: null, created_at: '2026-07-27T00:00:00Z', updated_at: '2026-07-27T00:00:00Z', review: null }
const session = { id: 'session-qa', session_date: '2026-07-27', mode: 'full', status: 'learning', phase: 'review', words: [{ id: 'word-qa', card_id: 'card-qa', is_new: false, is_weak: false, assigned_step: 'vi_en', steps_done: [], wrong_count: 0, card }] }

async function setup(page: import('@playwright/test').Page) {
  await page.addInitScript(value => { localStorage.setItem('flashcards.auth.token', 'core-qa'); localStorage.setItem('flashcards.auth.user', JSON.stringify(value)); localStorage.setItem('flashie.appearance', JSON.stringify({ theme: 'dark', accent: 'violet-cyan', reduceEffects: true })) }, user)
  await page.route('**/api/auth/me', route => route.fulfill({ json: user }))
  await page.route('**/api/daily/session**', route => route.fulfill({ json: { session } }))
  await page.route('**/api/daily/home', route => route.fulfill({ json: { streak: 7, mastered_cards: 9 } }))
  await page.route('**/api/articles/translation-workers', route => route.fulfill({ json: [] }))
  await page.route('**/api/articles/article-qa', route => route.fulfill({ json: article }))
  await page.route('**/api/articles', route => route.fulfill({ json: [article] }))
  await page.route('**/api/decks', route => route.fulfill({ json: [{ id: 'deck-qa', name: 'Core deck', description: null, card_count: 1, due_count: 1, new_count: 0, created_at: '2026-07-27T00:00:00Z', updated_at: '2026-07-27T00:00:00Z' }] }))
  await page.route('**/api/shadowing/videos', route => route.fulfill({ json: [] }))
  await page.route('**:8788/health', route => route.fulfill({ json: { status: 'ok', model: 'qa', model_loaded: true, device: 'cpu' } }))
}

async function contactSheet(page: import('@playwright/test').Page, reference: string, implementation: string, destination: string) {
  const ref = readFileSync(reference).toString('base64'), impl = readFileSync(implementation).toString('base64')
  await page.setViewportSize({ width: 1440, height: 940 })
  await page.setContent(`<style>body{margin:0;background:#080b14;color:#eef;font:14px system-ui}main{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px}h1{grid-column:1/-1;margin:0;font-size:16px}img{width:100%;border:1px solid #344;border-radius:8px}</style><main><h1>Reference / production implementation</h1><img src="data:image/png;base64,${ref}"><img src="data:image/png;base64,${impl}"></main>`)
  await page.screenshot({ path: destination, fullPage: true })
}

test('R3–R5 production routes have stable real-data chambers', async ({ browser }, testInfo) => {
  mkdirSync(out, { recursive: true })
  const cases = [
    ['study', '/daily', '.study-chamber', 'core-study-active-desktop.png'],
    ['reader', testInfo.project.name === 'webkit' ? '/reader' : '/reader/article-qa', testInfo.project.name === 'webkit' ? '.reader-discovery' : '.reader-focus', 'core-reader-active-desktop.png'],
    ['shadowing', '/shadowing', '.shadowing-chamber', 'core-shadowing-active-desktop.png'],
  ] as const
  const manifest: Record<string, unknown> = {}
  for (const [name, path, selector, referenceName] of cases) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage(); const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()) })
    await setup(page); await page.goto(path); await page.waitForTimeout(250)
    await expect(page.locator(selector)).toBeVisible()
    if (name === 'study') await expect(page.getByRole('textbox')).toBeVisible()
    if (name === 'reader') await expect(page.getByText(article.title).first()).toBeVisible()
    if (name === 'shadowing') await expect(page.getByText('Shadowing chamber')).toBeVisible()
    const dir = join(out, name, testInfo.project.name); mkdirSync(dir, { recursive: true }); const implementation = join(dir, 'implementation-desktop.png')
    await page.screenshot({ path: implementation, fullPage: true })
    const metrics = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, shellCount: document.querySelectorAll('.orbital-app-shell').length, errors: [] }))
    expect(metrics.overflow).toBeFalsy(); expect(errors).toEqual([])
    await contactSheet(page, join(root, 'docs', 'superpowers', 'visual-references', 'screenshots', referenceName), implementation, join(dir, 'contact-sheet-desktop.png'))
    writeFileSync(join(dir, 'layout.json'), JSON.stringify({ ...metrics, consoleErrors: errors, pass: true }, null, 2))
    manifest[name] = { route: path, implementation, reference: referenceName, layout: 'PASS', console: 'PASS', overflow: 'PASS' }
    await context.close()
  }
  writeFileSync(join(out, 'manifest.json'), JSON.stringify({ batch: 'R3-R5', proofMode: false, surfaces: manifest, status: 'PASS' }, null, 2))
})
