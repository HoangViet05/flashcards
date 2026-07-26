import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const artifactRoot = join(repoRoot, 'artifacts', 'visual-qa', 'r0-r1-shell-checkpoint-1')
const referenceRoot = join(repoRoot, 'docs', 'superpowers', 'visual-references', 'screenshots', 'cropped')
const canonicalPreview = 'C:/Users/Admin/.codex/visualizations/2026/07/26/019f9dab-65a3-7100-a171-d7101f52a773/flashie-today-directions-preview.html'

const views = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } } as const
const themes = { dark: { theme: 'dark', accent: 'violet-cyan', reduceEffects: true }, light: { theme: 'light', accent: 'violet-cyan', reduceEffects: true } } as const
type Theme = keyof typeof themes
type Device = keyof typeof views

const referenceFile = (theme: Theme, device: Device) => join(referenceRoot, `today-orbital-command-${theme}-${device}.png`)
const shellFile = (theme: Theme, device: Device) => join(artifactRoot, 'shell', `${theme}-${device}.png`)
const contactFile = (theme: Theme, device: Device) => join(artifactRoot, 'contact-sheets', `${theme}-${device}.png`)
const pngDataUrl = (file: string) => `data:image/png;base64,${readFileSync(file).toString('base64')}`

async function assertShell(page: import('@playwright/test').Page) {
  await expect(page.locator('[data-testid="shell-review"]')).toBeVisible()
  await expect(page.locator('.app-shell')).toBeVisible()
  expect(await page.locator('body').evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  expect(await page.locator('.desktop-rail, .mobile-nav').count()).toBeGreaterThan(0)
  expect(await page.locator('button[aria-label]').count()).toBeGreaterThan(0)
}

test.describe.configure({ mode: 'serial' })

test('crops the approved Today reference to the app viewport only', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Reference capture is deterministic in Chromium and is shared by browser checks.')
  mkdirSync(referenceRoot, { recursive: true })
  for (const [theme] of Object.entries(themes) as [Theme, unknown][]) {
    for (const [device, viewport] of Object.entries(views) as [Device, { width: number; height: number }][]) {
      await page.emulateMedia({ colorScheme: theme })
      await page.setViewportSize(viewport)
      await page.goto(pathToFileURL(canonicalPreview).href)
      const frame = page.frameLocator('iframe')
      if (device === 'mobile') await frame.locator('#ftd-device').click()
      await expect(frame.locator('.ftd-screen')).toBeVisible()
      await frame.locator('.viz-controls, .ftd-caption, .ftd-approval, .ftd-selection').evaluateAll((nodes) => nodes.forEach((node) => (node as HTMLElement).style.display = 'none'))
      await page.locator('iframe').screenshot({ path: referenceFile(theme, device) })
    }
  }
})

for (const [theme, appearance] of Object.entries(themes) as [Theme, typeof themes[Theme]][]) {
  for (const [device, viewport] of Object.entries(views) as [Device, { width: number; height: number }][]) {
    test(`real AppShell has a safe ${theme} ${device} review`, async ({ page }) => {
      mkdirSync(join(artifactRoot, 'shell'), { recursive: true })
      await page.addInitScript((value) => localStorage.setItem('flashie.appearance', JSON.stringify(value)), appearance)
      await page.setViewportSize(viewport)
      await page.goto('/__visual-shell')
      await assertShell(page)
      await page.screenshot({ path: shellFile(theme, device) })
    })
  }
}

test('creates equal-theme equal-viewport shell contact sheets without prototype controls', async ({ page }) => {
  const contactRoot = join(artifactRoot, 'contact-sheets')
  mkdirSync(contactRoot, { recursive: true })
  for (const [theme] of Object.entries(themes) as [Theme, unknown][]) {
    for (const [device, viewport] of Object.entries(views) as [Device, { width: number; height: number }][]) {
      await page.setViewportSize(viewport)
      const reference = pngDataUrl(referenceFile(theme, device))
      const implementation = pngDataUrl(shellFile(theme, device))
      await page.setContent(`<style>html,body{margin:0;background:#0b1020;color:#e8edff;font:600 14px system-ui}main{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px}figure{min-width:0;margin:0;border:1px solid #3a4969;border-radius:10px;overflow:hidden;background:#111a2d}figcaption{padding:8px 10px}img{display:block;width:100%;height:auto;background:#0b1020}</style><main><figure><figcaption>Approved app viewport · ${theme} · ${device}</figcaption><img data-kind="reference" src="${reference}"></figure><figure><figcaption>Real AppShell · ${theme} · ${device}</figcaption><img data-kind="implementation" src="${implementation}"></figure></main>`)
      await expect(page.locator('img')).toHaveCount(2)
      expect(await page.locator('img').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))).toBeTruthy()
      await page.locator('main').screenshot({ path: contactFile(theme, device) })
    }
  }
})

test('real AppShell has no 320px overflow or console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.addInitScript(() => localStorage.setItem('flashie.appearance', JSON.stringify(themes.dark)))
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/__visual-shell')
  await assertShell(page)
  expect(errors).toEqual([])
  await page.screenshot({ path: join(artifactRoot, 'shell', 'dark-compact.png') })
})
