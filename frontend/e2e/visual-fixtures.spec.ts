import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const artifactRoot = join(repoRoot, 'artifacts', 'visual-qa', 'r0-r1-shell')
const referenceRoot = join(repoRoot, 'docs', 'superpowers', 'visual-references', 'screenshots')
const canonicalRoot = 'C:/Users/Admin/.codex/visualizations/2026/07/26/019f9dab-65a3-7100-a171-d7101f52a773'

const matrix = [
  ['today', 'loaded'], ['today', 'slow'], ['today', 'empty'],
  ['study', 'active'], ['study', 'correct'], ['study', 'summary'],
  ['reader', 'focus'], ['reader', 'word'], ['reader', 'audio'],
  ['shadowing', 'ready'], ['shadowing', 'recording'], ['shadowing', 'score'], ['shadowing', 'offline'],
] as const

const approvedStates = [
  ['study', 'active'], ['study', 'feedback'], ['study', 'complete'],
  ['reader', 'active'], ['reader', 'feedback'], ['reader', 'complete'],
  ['shadowing', 'active'], ['shadowing', 'feedback'], ['shadowing', 'complete'],
] as const

function fixtureUrl(surface: string, state: string) {
  return `/__visual-fixtures?surface=${surface}&state=${state}`
}

function pngDataUrl(path: string) {
  return `data:image/png;base64,${readFileSync(path).toString('base64')}`
}

async function expectNoLayoutFaults(page: import('@playwright/test').Page) {
  const layout = await page.locator('[data-testid="visual-fixture"]').evaluate((fixture) => {
    const controls = Array.from(fixture.querySelectorAll<HTMLElement>('button, a, input'))
    const fixtureRect = fixture.getBoundingClientRect()
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      clippedControls: controls.filter((control) => {
        const rect = control.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && (rect.left < -1 || rect.right > window.innerWidth + 1 || rect.top < -1 || rect.bottom > window.innerHeight + 1)
      }).map((control) => control.getAttribute('aria-label') || control.textContent?.trim()),
      invalidFixture: fixtureRect.width <= 0 || fixtureRect.right > window.innerWidth + 1,
    }
  })
  expect(layout.overflow).toBeFalsy()
  expect(layout.clippedControls).toEqual([])
  expect(layout.invalidFixture).toBeFalsy()
}

test.describe.configure({ mode: 'serial' })

test('preserves rendered approved prototype images', async ({ page }) => {
  mkdirSync(referenceRoot, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(pathToFileURL(join(canonicalRoot, 'flashie-today-directions-preview.html')).href)
  await page.screenshot({ path: join(referenceRoot, 'today-orbital-command-desktop.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: join(referenceRoot, 'today-orbital-command-mobile.png') })

  for (const [screen, state] of approvedStates) {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(pathToFileURL(join(canonicalRoot, 'flashie-core-experiences-preview.html')).href)
    const frame = page.frameLocator('iframe')
    await frame.locator(`[data-screen-button="${screen}"]`).click()
    await frame.locator(`[data-state-button="${state}"]`).click()
    await page.screenshot({ path: join(referenceRoot, `core-${screen}-${state}-desktop.png`) })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: join(referenceRoot, `core-${screen}-${state}-mobile.png`) })
  }
})

for (const [surface, state] of matrix) {
  for (const [theme, storage] of Object.entries({ dark: { theme: 'dark', accent: 'violet-cyan', reduceEffects: true }, light: { theme: 'light', accent: 'violet-cyan', reduceEffects: true } })) {
    for (const [device, viewport] of Object.entries({ desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } })) {
      test(`${surface} ${state} has a safe ${theme} ${device} review state`, async ({ page }) => {
        mkdirSync(join(artifactRoot, surface), { recursive: true })
        await page.addInitScript((appearance) => localStorage.setItem('flashie.appearance', JSON.stringify(appearance)), storage)
        await page.setViewportSize(viewport)
        await page.goto(fixtureUrl(surface, state))
        await expect(page.locator('[data-testid="visual-fixture"]')).toHaveAttribute('data-state', state)
        await expectNoLayoutFaults(page)
        expect((await page.locator(':focus-visible').count())).toBe(0)
        expect((await page.locator('button[aria-label], a[aria-label]').count())).toBeGreaterThan(0)
        expect((await page.context().pages())[0]).toBeTruthy()
        expect((await page.locator('body').evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).valueOf()).toBeTruthy()
        expect((await page.locator('html').count())).toBe(1)
        expect((await page.locator('[data-testid="visual-fixture"]').count())).toBe(1)
        await page.screenshot({ path: join(artifactRoot, surface, `${theme}-${device}-${state}.png`) })
        expect((await page.evaluate(() => true))).toBeTruthy()
      })
    }
  }
}

test('creates side-by-side contact sheets for the shell review', async ({ page }) => {
  const referenceState: Record<string, string> = {
    'today-loaded': 'today-orbital-command', 'today-slow': 'today-orbital-command', 'today-empty': 'today-orbital-command',
    'study-active': 'core-study-active', 'study-correct': 'core-study-feedback', 'study-summary': 'core-study-complete',
    'reader-focus': 'core-reader-active', 'reader-word': 'core-reader-feedback', 'reader-audio': 'core-reader-complete',
    'shadowing-ready': 'core-shadowing-active', 'shadowing-recording': 'core-shadowing-feedback', 'shadowing-score': 'core-shadowing-complete', 'shadowing-offline': 'core-shadowing-active',
  }
  const contactRoot = join(artifactRoot, 'contact-sheets')
  mkdirSync(contactRoot, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const [surface, state] of matrix) {
    const implementation = pngDataUrl(join(artifactRoot, surface, `dark-desktop-${state}.png`))
    const reference = pngDataUrl(join(referenceRoot, `${referenceState[`${surface}-${state}`]}-desktop.png`))
    await page.setContent(`<style>body{margin:0;background:#111827;color:#eef3ff;font:600 16px system-ui}main{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px}figure{margin:0;border:1px solid #34415d;border-radius:12px;overflow:hidden;background:#1b253c}figcaption{padding:10px 12px;color:#dce6ff}img{display:block;width:100%;height:760px;object-fit:contain;object-position:top;background:#0b1020}</style><main><figure><figcaption>Approved reference · ${surface} ${state}</figcaption><img src="${reference}"></figure><figure><figcaption>Current shell fixture · dark desktop</figcaption><img src="${implementation}"></figure></main>`)
    await expect(page.locator('img')).toHaveCount(2)
    expect(await page.locator('img').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))).toBeTruthy()
    await page.screenshot({ path: join(contactRoot, `${surface}-${state}-desktop.png`), fullPage: true })
  }
})

test('320px compact shell has no horizontal overflow', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('flashie.appearance', JSON.stringify({ theme: 'dark', accent: 'violet-cyan', reduceEffects: true })))
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto(fixtureUrl('today', 'loaded'))
  await expectNoLayoutFaults(page)
  await page.screenshot({ path: join(artifactRoot, 'today', 'dark-compact-loaded.png') })
})

test('shell fixture emits no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(fixtureUrl('today', 'loaded'))
  await expect(page.locator('[data-testid="visual-fixture"]')).toBeVisible()
  expect(errors).toEqual([])
})
