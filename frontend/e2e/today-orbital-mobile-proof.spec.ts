import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const source = 'C:/Users/Admin/.codex/visualizations/2026/07/26/019f9dab-65a3-7100-a171-d7101f52a773/flashie-today-directions-preview.html'
const approvedDesktop = join(root, 'artifacts', 'visual-qa', 'today-loaded-light-1440-proof', 'implementation.png')
const approvedMobile = join(root, 'artifacts', 'visual-qa', 'today-loaded-light-390-proof', 'implementation.png')
const output = join(root, 'artifacts', 'visual-qa', 'today-loaded-light-390-proof')
const dataUrl = (file: string) => `data:image/png;base64,${readFileSync(file).toString('base64')}`

async function writeVisualProof(page: import('@playwright/test').Page, referenceFile: string, implementationFile: string) {
  const reference = dataUrl(referenceFile); const implementation = dataUrl(implementationFile)
  await page.setViewportSize({ width: 780, height: 872 })
  await page.setContent('<style>html,body{margin:0;overflow:hidden;background:#fff}canvas{display:block}</style><canvas id="canvas" width="780" height="872"></canvas>')
  await page.evaluate(async ({ reference, implementation }) => {
    const load = (src: string) => new Promise<HTMLImageElement>((done, fail) => { const image = new Image(); image.onload = () => done(image); image.onerror = fail; image.src = src })
    const [left, right] = await Promise.all([load(reference), load(implementation)]); const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!; const context = canvas.getContext('2d')!
    context.fillStyle = '#fff'; context.fillRect(0, 0, 780, 872); context.fillStyle = '#1a1c1f'; context.font = '500 12px system-ui'; context.fillText('Approved reference · 390×844', 6, 17); context.fillText('Actual production HomePage', 396, 17); context.drawImage(left, 0, 28); context.drawImage(right, 390, 28)
  }, { reference, implementation })
  await page.locator('#canvas').screenshot({ path: join(output, 'contact-sheet.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.setContent('<style>html,body{margin:0;overflow:hidden;background:#fff}canvas{display:block}</style><canvas id="canvas" width="390" height="844"></canvas>')
  const metrics = await page.evaluate(async ({ reference, implementation }) => {
    const load = (src: string) => new Promise<HTMLImageElement>((done, fail) => { const image = new Image(); image.onload = () => done(image); image.onerror = fail; image.src = src })
    const [left, right] = await Promise.all([load(reference), load(implementation)]); const a = document.createElement('canvas'); const b = document.createElement('canvas'); a.width = b.width = 390; a.height = b.height = 844; a.getContext('2d')!.drawImage(left, 0, 0); b.getContext('2d')!.drawImage(right, 0, 0)
    const expected = a.getContext('2d')!.getImageData(0, 0, 390, 844); const actual = b.getContext('2d')!.getImageData(0, 0, 390, 844); const heat = document.querySelector<HTMLCanvasElement>('#canvas')!.getContext('2d')!.createImageData(390, 844); let changed = 0
    for (let index = 0; index < expected.data.length; index += 4) { const delta = Math.max(...[0, 1, 2, 3].map((offset) => Math.abs(expected.data[index + offset] - actual.data[index + offset]))); if (delta > 10) { changed++; heat.data.set([235, 48, 48, 255], index) } else { const shade = Math.round((actual.data[index] + actual.data[index + 1] + actual.data[index + 2]) / 12); heat.data.set([shade, shade, shade, 255], index) } }
    document.querySelector<HTMLCanvasElement>('#canvas')!.getContext('2d')!.putImageData(heat, 0, 0)
    return { viewport: '390x844', antiAliasingThreshold: 10, changedPixels: changed, totalPixels: 329160, changedPixelPercentage: Number((changed * 100 / 329160).toFixed(4)) }
  }, { reference, implementation })
  await page.locator('#canvas').screenshot({ path: join(output, 'pixel-diff-heatmap.png') }); writeFileSync(join(output, 'pixel-diff.json'), `${JSON.stringify(metrics, null, 2)}\n`)
}

test('approved Today desktop baseline has not regressed', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Chromium baseline only.')
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/'); await expect(page.locator('[data-testid="today-orbital-command"]')).toBeVisible()
  const current = await page.screenshot(); const baseline = readFileSync(approvedDesktop); const currentHash = createHash('sha256').update(current).digest('hex'); const baselineHash = createHash('sha256').update(baseline).digest('hex'); mkdirSync(output, { recursive: true }); writeFileSync(join(output, 'desktop-regression-current.png'), current)
  await page.setContent('<canvas id="pixels" width="1440" height="900"></canvas>')
  const pixelDelta = await page.evaluate(async ({ expected, actual }) => { const load = (src: string) => new Promise<HTMLImageElement>((done, fail) => { const image = new Image(); image.onload = () => done(image); image.onerror = fail; image.src = src }); const [a, b] = await Promise.all([load(expected), load(actual)]); const canvas = document.querySelector<HTMLCanvasElement>('#pixels')!; const context = canvas.getContext('2d')!; context.drawImage(a, 0, 0); const left = context.getImageData(0, 0, 1440, 900); context.clearRect(0, 0, 1440, 900); context.drawImage(b, 0, 0); const right = context.getImageData(0, 0, 1440, 900); let changed = 0; let maxDelta = 0; const samples: number[][] = []; for (let i = 0; i < left.data.length; i += 4) { const delta = Math.max(...[0, 1, 2, 3].map(offset => Math.abs(left.data[i + offset] - right.data[i + offset]))); if (delta) { changed++; if (samples.length < 30) samples.push([i / 4 % 1440, Math.floor(i / 4 / 1440), delta]) }; maxDelta = Math.max(maxDelta, delta) } return { changed, maxDelta, samples } }, { expected: `data:image/png;base64,${baseline.toString('base64')}`, actual: `data:image/png;base64,${current.toString('base64')}` })
  writeFileSync(join(output, 'desktop-regression-pixel-delta.json'), `${JSON.stringify(pixelDelta, null, 2)}\n`)
  expect(currentHash).toBe(baselineHash); writeFileSync(join(output, 'desktop-regression.json'), `${JSON.stringify({ approvedBaselineUnchanged: true, viewport: '1440x900', sha256: currentHash }, null, 2)}\n`)
})

test('mobile navigation reserves content space and has no layout errors', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Chromium layout gate only.')
  const errors: string[] = []; page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' }); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await expect(page.locator('.ftd-mobile-nav')).toBeVisible()
  expect(await page.locator('body').evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  const firstViewport = await page.evaluate(() => { const cta = document.querySelector<HTMLElement>('.ftd-core-copy .btn-primary')!.getBoundingClientRect(); const orb = document.querySelector<HTMLElement>('.ftd-core-orb')!.getBoundingClientRect(); return cta.top >= 0 && cta.bottom <= innerHeight && orb.top >= 0 && orb.bottom <= innerHeight })
  expect(firstViewport).toBeTruthy()
  const initial = await page.evaluate(() => { const nav = document.querySelector<HTMLElement>('.ftd-mobile-nav')!.getBoundingClientRect(); const missions = document.querySelector<HTMLElement>('.ftd-missions')!.getBoundingClientRect(); const heading = document.querySelector<HTMLElement>('.ftd-section-title')!.getBoundingClientRect(); const first = document.querySelector<HTMLElement>('.ftd-mission')!.getBoundingClientRect(); return { missionTop: missions.top, navHeight: nav.height, clear: missions.top >= 590 && missions.top <= 610 && heading.bottom <= nav.top && first.bottom <= nav.top } })
  if (!initial.clear) throw new Error(`Mobile first viewport layout is invalid: ${JSON.stringify(initial)}`)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const atEnd = await page.evaluate(() => { const nav = document.querySelector<HTMLElement>('.ftd-mobile-nav')!.getBoundingClientRect(); const last = document.querySelector<HTMLElement>('.ftd-mission:last-child')!.getBoundingClientRect(); return { clear: last.bottom <= nav.top, navTop: nav.top, lastBottom: last.bottom, scrollHeight: document.documentElement.scrollHeight } })
  if (!atEnd.clear) throw new Error(`Mobile navigation overlaps final mission: ${JSON.stringify(atEnd)}`); expect(errors).toEqual([])
})

test('actual HomePage: Today / loaded / light / 390x844 proof', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Chromium raster proof only.'); mkdirSync(output, { recursive: true }); await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 422, height: 876 }); await page.goto(pathToFileURL(source).href); const frame = page.frameLocator('iframe'); await expect(frame.locator('#flashie-today-directions[data-concept="orbital"]')).toBeVisible(); await frame.locator('#ftd-device').click(); await frame.locator('.viz-controls, .ftd-caption, .ftd-approval, .ftd-selection').evaluateAll((items) => items.forEach((item) => (item as HTMLElement).style.display = 'none')); await page.locator('iframe').screenshot({ path: join(output, 'reference.png') })
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await expect(page.locator('[data-testid="today-orbital-command"]')).toBeVisible(); expect(await page.locator('body').evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy(); await expect(page.locator('.ftd-mobile-nav')).toBeVisible(); await expect(page.locator('.ftd-rail')).toBeHidden(); const current = await page.screenshot({ path: join(output, 'implementation-current.png') })
  const expected = readFileSync(approvedMobile); const currentHash = createHash('sha256').update(current).digest('hex'); expect(currentHash).toBe(createHash('sha256').update(expected).digest('hex')); writeFileSync(join(output, 'mobile-regression.json'), `${JSON.stringify({ approvedBaselineUnchanged: true, viewport: '390x844', sha256: currentHash }, null, 2)}\n`)
  await writeVisualProof(page, join(output, 'reference.png'), join(output, 'implementation-current.png'))
})
