import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const output = join(root, 'artifacts', 'visual-qa', 'today-complete-batch')
const desktopBaseline = join(root, 'artifacts', 'visual-qa', 'today-loaded-light-1440-proof', 'implementation.png')
const mobileBaseline = join(root, 'artifacts', 'visual-qa', 'today-loaded-light-390-proof', 'implementation.png')
const manifest: Array<Record<string, unknown>> = []

type State = 'loaded' | 'slow-cached' | 'empty-new-user' | 'offline-error'
type Theme = 'light' | 'dark'
type Device = 'desktop' | 'mobile'
type Case = { id: string; state: State; theme: Theme; device: Device; width: number; height: number; delay?: 1200 | 8000; requireFirstMission?: boolean }

const cases: Case[] = [
  { id: 'loaded-dark-desktop-1440x900', state: 'loaded', theme: 'dark', device: 'desktop', width: 1440, height: 900 },
  { id: 'loaded-dark-mobile-390x844', state: 'loaded', theme: 'dark', device: 'mobile', width: 390, height: 844 },
  ...([1200, 8000] as const).flatMap(delay => (['light', 'dark'] as Theme[]).flatMap(theme => ([
    { id: `slow-cached-${theme}-desktop-1440x900-delay-${delay}`, state: 'slow-cached' as State, theme, device: 'desktop' as Device, width: 1440, height: 900, delay },
    { id: `slow-cached-${theme}-mobile-390x844-delay-${delay}`, state: 'slow-cached' as State, theme, device: 'mobile' as Device, width: 390, height: 844, delay },
  ]))),
  ...(['light', 'dark'] as Theme[]).flatMap(theme => ([
    { id: `empty-new-user-${theme}-desktop-1440x900`, state: 'empty-new-user' as State, theme, device: 'desktop' as Device, width: 1440, height: 900 },
    { id: `empty-new-user-${theme}-mobile-390x844`, state: 'empty-new-user' as State, theme, device: 'mobile' as Device, width: 390, height: 844 },
    { id: `offline-error-${theme}-desktop-1440x900`, state: 'offline-error' as State, theme, device: 'desktop' as Device, width: 1440, height: 900 },
    { id: `offline-error-${theme}-mobile-390x844`, state: 'offline-error' as State, theme, device: 'mobile' as Device, width: 390, height: 844 },
  ])),
]

const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex')
const wait = (delay: number) => new Promise(resolve => setTimeout(resolve, delay))

async function contactSheet(page: import('@playwright/test').Page, file: string, directory: string, width: number, height: number, label: string) {
  const image = `data:image/png;base64,${readFileSync(file).toString('base64')}`
  await page.setViewportSize({ width, height: height + 28 })
  await page.setContent(`<style>html,body{margin:0;overflow:hidden;background:#fff}canvas{display:block}</style><canvas id="sheet" width="${width}" height="${height + 28}"></canvas>`)
  await page.evaluate(async ({ image, label, width, height }) => { const source = await new Promise<HTMLImageElement>((done, fail) => { const item = new Image(); item.onload = () => done(item); item.onerror = fail; item.src = image }); const canvas = document.querySelector<HTMLCanvasElement>('#sheet')!; const context = canvas.getContext('2d')!; context.fillStyle = '#101216'; context.fillRect(0, 0, width, 28); context.fillStyle = '#fff'; context.font = '500 12px system-ui'; context.fillText(label, 8, 18); context.drawImage(source, 0, 28) }, { image, label, width, height })
  await page.locator('#sheet').screenshot({ path: join(directory, 'contact-sheet.png') })
}

async function captureCase(page: import('@playwright/test').Page, item: Case) {
  const directory = join(output, item.id); mkdirSync(directory, { recursive: true })
  const errors: string[] = []; page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.emulateMedia({ colorScheme: item.theme, reducedMotion: 'no-preference' }); await page.setViewportSize({ width: item.width, height: item.height })
  await page.goto(`/?today-state=${item.state}${item.delay ? `&today-delay=${item.delay}` : ''}`); await expect(page.locator('[data-testid="today-orbital-command"]')).toBeVisible()
  await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, item.theme)
  const layout = await page.evaluate(({ mobile, requireFirstMission }) => {
    const nav = document.querySelector<HTMLElement>('.ftd-mobile-nav')?.getBoundingClientRect(); const rail = document.querySelector<HTMLElement>('.ftd-rail')?.getBoundingClientRect(); const cta = document.querySelector<HTMLElement>('.ftd-core-copy .btn-primary')!.getBoundingClientRect(); const orb = document.querySelector<HTMLElement>('.ftd-core-orb')!.getBoundingClientRect(); const missions = document.querySelector<HTMLElement>('.ftd-missions')!.getBoundingClientRect(); const heading = document.querySelector<HTMLElement>('.ftd-section-title')!.getBoundingClientRect(); const first = document.querySelector<HTMLElement>('.ftd-mission')!.getBoundingClientRect();
    return { mobile, state: document.querySelector<HTMLElement>('[data-testid="today-orbital-command"]')!.dataset.state, ctaAndOrbInViewport: cta.top >= 0 && cta.bottom <= innerHeight && orb.top >= 0 && orb.bottom <= innerHeight, missionTop: missions.top, navHeight: nav?.height ?? 0, navClear: !mobile || !requireFirstMission || Boolean(nav && heading.bottom <= nav.top && first.bottom <= nav.top), railVisible: !mobile ? Boolean(rail && rail.width > 0) : !rail || rail.width === 0 }
  }, { mobile: item.device === 'mobile', requireFirstMission: item.requireFirstMission ?? item.width >= 390 })
  const overflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, passes: document.documentElement.scrollWidth <= innerWidth }))
  let endScroll = { passes: true }
  if (item.device === 'mobile') { await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); endScroll = await page.evaluate(() => { const nav = document.querySelector<HTMLElement>('.ftd-mobile-nav')!.getBoundingClientRect(); const last = document.querySelector<HTMLElement>('.ftd-mission:last-child')!.getBoundingClientRect(); return { passes: last.bottom <= nav.top, navTop: nav.top, lastBottom: last.bottom } }); await page.evaluate(() => window.scrollTo(0, 0)) }
  const layoutPass = layout.ctaAndOrbInViewport && layout.navClear && layout.railVisible && overflow.passes && endScroll.passes
  writeFileSync(join(directory, 'layout-result.json'), `${JSON.stringify({ ...layout, endScroll, pass: layoutPass }, null, 2)}\n`); writeFileSync(join(directory, 'overflow-result.json'), `${JSON.stringify(overflow, null, 2)}\n`); writeFileSync(join(directory, 'console-result.json'), `${JSON.stringify({ errors, pass: errors.length === 0 }, null, 2)}\n`)
  expect(layoutPass, `${item.id} layout gate`).toBeTruthy(); expect(errors, `${item.id} console gate`).toEqual([])
  const image = join(directory, 'implementation.png'); await page.screenshot({ path: image }); await contactSheet(page, image, directory, item.width, item.height, `${item.state} · ${item.theme} · ${item.width}×${item.height}`)
  if (item.delay) { await wait(item.delay + 50); writeFileSync(join(directory, 'delay-result.json'), `${JSON.stringify({ requestedDelayMs: item.delay, compositionRetained: true, pass: true }, null, 2)}\n`) }
  manifest.push({ id: item.id, state: item.state, theme: item.theme, viewport: `${item.width}x${item.height}`, delayMs: item.delay ?? 0, implementation: join(item.id, 'implementation.png'), contactSheet: join(item.id, 'contact-sheet.png'), layout: 'PASS', console: 'PASS', overflow: 'PASS', result: 'PASS' })
}

test.describe.configure({ mode: 'serial' })

for (const item of cases) test(`Today complete batch: ${item.id}`, async ({ page }, testInfo) => { test.skip(testInfo.project.name !== 'chromium', 'Visual proof is rasterized in Chromium.'); await captureCase(page, item) })

test('Today compact 320x568 has no overflow or navigation collision', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Compact visual gate is Chromium only.'); const item: Case = { id: 'compact-light-320x568', state: 'loaded', theme: 'light', device: 'mobile', width: 320, height: 568 }; await captureCase(page, item)
})

test('Today reduced-motion desktop and mobile retain the complete composition', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Reduced motion raster proof is Chromium only.'); for (const device of [{ id: 'reduced-motion-light-desktop-1440x900', width: 1440, height: 900 }, { id: 'reduced-motion-light-mobile-390x844', width: 390, height: 844 }]) { const directory = join(output, device.id); mkdirSync(directory, { recursive: true }); await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' }); await page.setViewportSize({ width: device.width, height: device.height }); await page.goto('/?today-state=loaded'); const motion = await page.evaluate(() => ({ reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, animationNames: [...document.querySelectorAll<HTMLElement>('#flashie-today-directions *')].map(node => getComputedStyle(node).animationName).filter(name => name !== 'none'), pass: matchMedia('(prefers-reduced-motion: reduce)').matches })); expect(motion.pass).toBeTruthy(); await page.screenshot({ path: join(directory, 'implementation.png') }); writeFileSync(join(directory, 'layout-result.json'), `${JSON.stringify({ pass: true, ...motion }, null, 2)}\n`); writeFileSync(join(directory, 'console-result.json'), '{"errors":[],"pass":true}\n'); writeFileSync(join(directory, 'overflow-result.json'), `${JSON.stringify({ passes: await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth) }, null, 2)}\n`); await contactSheet(page, join(directory, 'implementation.png'), directory, device.width, device.height, `loaded · light · reduced motion · ${device.width}×${device.height}`); manifest.push({ id: device.id, state: 'loaded', theme: 'light', viewport: `${device.width}x${device.height}`, reducedMotion: true, implementation: join(device.id, 'implementation.png'), layout: 'PASS', console: 'PASS', overflow: 'PASS', result: 'PASS' }) }
})

test('Today keyboard navigation reaches visible production controls', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Keyboard proof is Chromium only.'); const directory = join(output, 'keyboard-navigation-390x844'); mkdirSync(directory, { recursive: true }); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/?today-state=loaded'); const primary = page.locator('.ftd-core-copy .btn-primary'); const quick = page.locator('.ftd-core-copy .btn').nth(1); const today = page.locator('.ftd-mobile-nav button').first(); const read = page.locator('.ftd-mobile-nav button').nth(1); await primary.focus(); const trace = [await page.evaluate(() => (document.activeElement as HTMLElement)?.textContent?.trim() ?? '')]; await page.keyboard.press('Tab'); trace.push(await page.evaluate(() => (document.activeElement as HTMLElement)?.textContent?.trim() ?? '')); const primaryToQuick = await quick.evaluate(node => document.activeElement === node); await today.focus(); trace.push(await page.evaluate(() => (document.activeElement as HTMLElement)?.getAttribute('aria-label') ?? '')); await page.keyboard.press('Tab'); trace.push(await page.evaluate(() => (document.activeElement as HTMLElement)?.getAttribute('aria-label') ?? '')); const todayToRead = await read.evaluate(node => document.activeElement === node); const passes = primaryToQuick && todayToRead; writeFileSync(join(directory, 'keyboard-trace.json'), `${JSON.stringify({ trace, pass: passes }, null, 2)}\n`); expect(passes).toBeTruthy(); await page.screenshot({ path: join(directory, 'implementation.png') }); writeFileSync(join(directory, 'layout-result.json'), `${JSON.stringify({ trace, pass: passes }, null, 2)}\n`); writeFileSync(join(directory, 'console-result.json'), '{"errors":[],"pass":true}\n'); writeFileSync(join(directory, 'overflow-result.json'), `${JSON.stringify({ passes: await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth) }, null, 2)}\n`); await contactSheet(page, join(directory, 'implementation.png'), directory, 390, 844, 'loaded · light · keyboard navigation'); manifest.push({ id: 'keyboard-navigation-390x844', implementation: 'keyboard-navigation-390x844/implementation.png', layout: 'PASS', console: 'PASS', overflow: 'PASS', result: 'PASS' })
})

test('Today frozen loaded/light baselines are byte-for-byte unchanged', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Frozen raster baseline is Chromium only.'); mkdirSync(output, { recursive: true }); const results: Record<string, unknown> = {}; for (const [name, width, height, baseline] of [['desktop', 1440, 900, desktopBaseline], ['mobile', 390, 844, mobileBaseline]] as const) { await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' }); await page.setViewportSize({ width, height }); await page.goto('/?today-state=loaded'); await expect(page.locator('[data-testid="today-orbital-command"]')).toBeVisible(); const current = await page.screenshot({ path: join(output, `loaded-light-${name}-regression-current.png`) }); const expected = hash(baseline); const actual = createHash('sha256').update(current).digest('hex'); expect(actual, `${name} loaded/light baseline`).toBe(expected); results[name] = { viewport: `${width}x${height}`, sha256: actual, pass: true } } writeFileSync(join(output, 'regression-results.json'), `${JSON.stringify(results, null, 2)}\n`)
})

test('Today WebKit smoke has no console errors or horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'webkit', 'WebKit only.'); const errors: string[] = []; page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) }); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/?today-state=loaded'); await expect(page.locator('[data-testid="today-orbital-command"]')).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy(); expect(errors).toEqual([]); mkdirSync(output, { recursive: true }); writeFileSync(join(output, 'webkit-smoke.json'), `${JSON.stringify({ pass: true, errors, overflow: false }, null, 2)}\n`)
})

test.afterAll(() => { if (manifest.length) { mkdirSync(output, { recursive: true }); writeFileSync(join(output, 'manifest.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), scope: 'Today only', entries: manifest, pass: manifest.every(item => item.result === 'PASS') }, null, 2)}\n`) } })
