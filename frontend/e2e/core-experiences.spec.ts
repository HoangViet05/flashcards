import { expect, test, type Page } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const out = join(root, 'artifacts', 'visual-qa', 'r3-r5-core-batch-v2')
const user = { id: 'core-qa', email: 'core@example.test', name: 'Core QA', preferred_level: 2, created_at: '2026-07-27T00:00:00Z', preferences: null }
const card = { id: 'card-qa', deck_id: 'deck-qa', front_text: 'signal', back_text: 'tín hiệu', example_sentence: 'A clear signal helps memory return.', pronunciation: null, definition: null, image_url: null, audio_url: null, example_audio_url: null, source_type: null, source_name: null, created_at: '2026-07-27T00:00:00Z', updated_at: '2026-07-27T00:00:00Z', review: null }
const article = { id: 'article-qa', title: 'Signals in the quiet network', source_type: 'paste', source_url: null, word_count: 18, has_summary: false, translation_status: null, created_at: '2026-07-27T00:00:00Z', content: 'A quiet network carries clear signals. Learners notice a signal, repeat it, and return when the memory needs attention.', document_id: null, deck_id: null, summary: null, level: 2 }
const session = { id: 'session-qa', session_date: '2026-07-27', mode: 'full', status: 'learning', phase: 'review', words: [{ id: 'word-qa', card_id: 'card-qa', is_new: false, is_weak: false, assigned_step: 'vi_en', steps_done: [], wrong_count: 0, card }] }

type Scenario = 'study-active' | 'study-correct' | 'study-wrong' | 'study-summary' | 'reader-loaded' | 'reader-empty' | 'reader-loading' | 'reader-catalog' | 'reader-focus' | 'reader-word' | 'reader-audio' | 'shadow-ready' | 'shadow-recording' | 'shadow-processing' | 'shadow-score' | 'shadow-offline' | 'shadow-permission'
type Screen = 'study' | 'reader' | 'shadowing'
type PrototypeState = 'active' | 'feedback' | 'complete'
type Case = { id: Scenario; screen: Screen; route: string; selector: string; prototype: PrototypeState }

const cases: Case[] = [
  { id: 'study-active', screen: 'study', route: '/daily', selector: '.study-chamber', prototype: 'active' },
  { id: 'study-correct', screen: 'study', route: '/daily', selector: '.exercise-card--correct', prototype: 'feedback' },
  { id: 'study-wrong', screen: 'study', route: '/daily', selector: '.exercise-card--wrong', prototype: 'feedback' },
  { id: 'study-summary', screen: 'study', route: '/daily', selector: '.study-chamber', prototype: 'complete' },
  { id: 'reader-loaded', screen: 'reader', route: '/reader', selector: '.reader-discovery', prototype: 'active' },
  { id: 'reader-empty', screen: 'reader', route: '/reader', selector: '.reader-discovery', prototype: 'active' },
  { id: 'reader-loading', screen: 'reader', route: '/reader', selector: '.reader-discovery', prototype: 'active' },
  { id: 'reader-catalog', screen: 'reader', route: '/reader', selector: '.reader-discovery', prototype: 'active' },
  { id: 'reader-focus', screen: 'reader', route: '/reader/article-qa', selector: '.reader-focus', prototype: 'active' },
  { id: 'reader-word', screen: 'reader', route: '/reader/article-qa', selector: '.reader-word-popup', prototype: 'feedback' },
  { id: 'reader-audio', screen: 'reader', route: '/reader/article-qa', selector: '.reading-companion-dock', prototype: 'complete' },
  { id: 'shadow-ready', screen: 'shadowing', route: '/shadowing', selector: '.voice-calibration-setup', prototype: 'active' },
  { id: 'shadow-recording', screen: 'shadowing', route: '/shadowing', selector: '.voice-stage--recording', prototype: 'feedback' },
  { id: 'shadow-processing', screen: 'shadowing', route: '/shadowing', selector: '.voice-stage--processing', prototype: 'feedback' },
  { id: 'shadow-score', screen: 'shadowing', route: '/shadowing', selector: '.voice-stage--score', prototype: 'complete' },
  { id: 'shadow-offline', screen: 'shadowing', route: '/shadowing', selector: '.voice-stage--offline', prototype: 'active' },
  { id: 'shadow-permission', screen: 'shadowing', route: '/shadowing', selector: '.voice-notice--error', prototype: 'feedback' },
]
const selectedCases = process.env.CORE_QA_STATES ? cases.filter(item => process.env.CORE_QA_STATES!.split(',').includes(item.id)) : cases

async function setup(page: Page, theme: 'light' | 'dark', reduceEffects: boolean, scenario: Scenario) {
  await page.addInitScript(({ user, theme, reduceEffects, scenario }) => {
    localStorage.setItem('flashcards.auth.token', 'core-qa'); localStorage.setItem('flashcards.auth.user', JSON.stringify(user)); localStorage.setItem('flashie.appearance', JSON.stringify({ theme, accent: 'violet-cyan', reduceEffects }))
    if (scenario.startsWith('shadow-')) {
      class QaRecorder { static isTypeSupported() { return true }; state = 'inactive'; mimeType = 'audio/webm'; stream = { getTracks: () => [] }; ondataavailable: ((event: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null; start() { this.state = 'recording' }; stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['qa'], { type: this.mimeType }) }); this.onstop?.() } }
      ;(window as any).__flashieRecorderApi = { getUserMedia: () => scenario === 'shadow-permission' ? Promise.reject(new DOMException('Permission denied', 'NotAllowedError')) : Promise.resolve({ getTracks: () => [] }), MediaRecorder: QaRecorder }
    }
  }, { user, theme, reduceEffects, scenario })
  await page.route('**/api/auth/me', route => route.fulfill({ json: user }))
  await page.route('**/api/daily/session**', route => route.fulfill({ json: { session: scenario === 'study-summary' ? { ...session, status: 'done' } : session } }))
  await page.route('**/api/daily/answer', route => route.fulfill({ json: {} }))
  await page.route('**/api/daily/home', route => route.fulfill({ json: { streak: 7, mastered_cards: 9 } }))
  await page.route('**/api/articles/translation-workers', route => route.fulfill({ json: [] }))
  await page.route('**/api/articles/catalog/**', route => route.fulfill({ json: [] }))
  await page.route('**/api/articles/article-qa', route => route.fulfill({ json: article }))
  await page.route('**/api/articles', async route => { if (scenario === 'reader-loading') { await new Promise(resolve => setTimeout(resolve, 4_000)) }; await route.fulfill({ json: scenario === 'reader-empty' ? [] : [article] }) })
  await page.route('**/api/decks', route => route.fulfill({ json: [{ id: 'deck-qa', name: 'Core deck', description: null, card_count: 1, due_count: 1, new_count: 0, created_at: '2026-07-27T00:00:00Z', updated_at: '2026-07-27T00:00:00Z' }] }))
  await page.route('**/api/shadowing/cards**', route => route.fulfill({ json: [card] }))
  await page.route('**/api/shadowing/videos', route => route.fulfill({ json: [] }))
  await page.route('**/api/shadowing/attempts', route => route.fulfill({ json: { id: 'attempt-qa' } }))
  await page.route('**:8788/health', route => scenario === 'shadow-offline' ? route.fulfill({ status: 503, json: { detail: 'offline' } }) : route.fulfill({ json: { status: 'ok', model: 'qa', model_loaded: true, device: 'cpu' } }))
  await page.route('**:8788/score', async route => { if (scenario === 'shadow-processing') await new Promise(resolve => setTimeout(resolve, 3_000)); await route.fulfill({ json: { score: 86, transcript: 'A clear signal helps memory return.', no_speech: false, words: [{ word: 'A', status: 'correct' }, { word: 'signal', status: 'correct' }, { word: 'helps', status: 'substituted' }] } }) })
}

async function prepare(page: Page, scenario: Scenario) {
  if (scenario === 'study-correct' || scenario === 'study-wrong') { await page.getByRole('textbox').fill(scenario === 'study-correct' ? 'signal' : 'noise'); await page.getByRole('button', { name: 'Check answer' }).click(); return }
  if (scenario === 'reader-catalog') { await page.getByRole('button', { name: 'Level library' }).click(); return }
  if (scenario === 'reader-word') { await page.locator('.reader-focus__article [data-reader-sentence] span').first().click(); return }
  if (scenario === 'reader-audio') { await page.getByRole('button', { name: 'Read from start' }).click(); return }
  if (scenario.startsWith('shadow-') && scenario !== 'shadow-ready' && scenario !== 'shadow-offline') {
    await page.getByRole('button', { name: 'Start calibration' }).first().click(); await expect(page.getByRole('button', { name: 'Record response' })).toBeVisible()
    await page.getByRole('button', { name: 'Record response' }).click()
    if (scenario !== 'shadow-recording' && scenario !== 'shadow-permission') { await page.getByRole('button', { name: 'Stop recording' }).click() }
  }
}

async function croppedReference(browser: import('@playwright/test').Browser, screen: Screen, state: PrototypeState, viewport: { width: number; height: number }, destination: string) {
  const context = await browser.newContext({ viewport }); const page = await context.newPage()
  await page.goto(`file:///${join(root, 'docs', 'superpowers', 'visual-references', 'core-experiences.html').replace(/\\/g, '/')}`)
  await page.addStyleTag({ content: 'html,body{margin:0!important;overflow:hidden!important}#flashie-core-experiences>.fce-controls,#flashie-core-experiences>.fce-states,#flashie-core-experiences>.fce-approval{display:none!important}#flashie-core-experiences{margin:0!important}#flashie-core-experiences .fce-screen{box-sizing:border-box;width:100vw!important;min-height:100vh!important;border-radius:0!important}' })
  await page.evaluate(({ screen, state }) => { const root = document.querySelector<HTMLElement>('#flashie-core-experiences')!; root.dataset.screen = screen; root.dataset.state = state; document.querySelectorAll<HTMLElement>('[data-screen-panel]').forEach(panel => { panel.hidden = panel.dataset.screenPanel !== screen }); document.querySelectorAll<HTMLElement>('[data-state-panel]').forEach(panel => { panel.hidden = panel.dataset.statePanel !== state }) }, { screen, state })
  await page.screenshot({ path: destination }); await context.close()
}

async function contactSheet(page: Page, reference: string, implementation: string, destination: string, viewport: { width: number; height: number }) {
  const ref = readFileSync(reference).toString('base64'), impl = readFileSync(implementation).toString('base64')
  await page.setViewportSize({ width: viewport.width * 2 + 36, height: viewport.height + 58 })
  await page.setContent(`<style>body{margin:0;background:#080b14;color:#eef;font:12px system-ui}main{display:grid;grid-template-columns:${viewport.width}px ${viewport.width}px;gap:12px;padding:12px}h1{grid-column:1/-1;margin:0;font-size:14px}figure{margin:0}figcaption{margin:0 0 6px;color:#b7c0e0}img{display:block;width:${viewport.width}px;height:${viewport.height}px;border:1px solid #344;border-radius:6px}</style><main><h1>Reference / production implementation</h1><figure><figcaption>Reference</figcaption><img src="data:image/png;base64,${ref}"></figure><figure><figcaption>Production route</figcaption><img src="data:image/png;base64,${impl}"></figure></main>`)
  await page.screenshot({ path: destination, fullPage: true })
}

test('R3–R5 deterministic production state matrix', async ({ browser }, testInfo) => {
  test.setTimeout(20 * 60_000); mkdirSync(out, { recursive: true }); const manifest: Record<string, unknown> = {}
  const variants = [['dark-desktop', { width: 1440, height: 900 }, 'dark' as const, false], ['light-desktop', { width: 1440, height: 900 }, 'light' as const, false], ['dark-mobile', { width: 390, height: 844 }, 'dark' as const, false], ['light-mobile', { width: 390, height: 844 }, 'light' as const, false], ['compact-320', { width: 320, height: 568 }, 'dark' as const, false], ['dark-desktop-reduced-motion', { width: 1440, height: 900 }, 'dark' as const, true]] as const
  for (const stateCase of selectedCases) for (const [variant, viewport, theme, reduceEffects] of variants) {
    const context = await browser.newContext({ viewport, reducedMotion: reduceEffects ? 'reduce' : 'no-preference' }); const page = await context.newPage(); const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()) })
    await setup(page, theme, reduceEffects, stateCase.id); await page.goto(stateCase.route); await page.waitForTimeout(stateCase.id === 'reader-loading' ? 150 : 250); await prepare(page, stateCase.id); await expect(page.locator(stateCase.selector)).toBeVisible()
    const dir = join(out, stateCase.id, variant, testInfo.project.name); mkdirSync(dir, { recursive: true }); const implementation = join(dir, 'implementation.png'), reference = join(dir, 'reference.png'), contact = join(dir, 'contact-sheet.png')
    await page.screenshot({ path: implementation }); await croppedReference(browser, stateCase.screen, stateCase.prototype, viewport, reference)
    const metrics = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, shellCount: document.querySelectorAll('#flashie-today-directions .ftd-screen').length }))
    expect(metrics.overflow).toBeFalsy(); expect(metrics.shellCount).toBe(1); expect(errors).toEqual([]); await contactSheet(page, reference, implementation, contact, viewport)
    const pass = !metrics.overflow && metrics.shellCount === 1 && errors.length === 0 && existsSync(implementation) && existsSync(reference) && existsSync(contact)
    writeFileSync(join(dir, 'layout.json'), JSON.stringify({ ...metrics, consoleErrors: errors, pass }, null, 2)); manifest[`${stateCase.id}:${variant}`] = { route: stateCase.route, state: stateCase.id, implementation, reference, contact, layout: metrics.overflow ? 'FAIL' : 'PASS', shell: metrics.shellCount === 1 ? 'PASS' : 'FAIL', console: errors.length ? 'FAIL' : 'PASS', artifacts: pass ? 'PASS' : 'FAIL', visualAcceptance: 'OWNER_REVIEW_REQUIRED' }
    await context.close()
  }
  const manifestPath = join(out, `manifest-${testInfo.project.name}.json`)
  const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) as { surfaces?: Record<string, unknown> } : {}
  const surfaces = { ...(previous.surfaces ?? {}), ...manifest }
  writeFileSync(manifestPath, JSON.stringify({ batch: 'R3-R5-v2', browser: testInfo.project.name, proofMode: false, status: Object.values(surfaces).every(item => (item as { artifacts: string }).artifacts === 'PASS') ? 'OWNER_REVIEW_REQUIRED' : 'FAIL', surfaces }, null, 2))
})
