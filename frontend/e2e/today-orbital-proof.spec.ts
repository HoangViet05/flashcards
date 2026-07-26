import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const output = join(root, 'artifacts', 'visual-qa', 'today-loaded-light-1440-proof')
const source = 'C:/Users/Admin/.codex/visualizations/2026/07/26/019f9dab-65a3-7100-a171-d7101f52a773/flashie-today-directions-preview.html'
const fileData = (file: string) => `data:image/png;base64,${readFileSync(file).toString('base64')}`

test('actual HomePage: Today / loaded / light / 1440x900 proof', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Chromium raster proof only.')
  mkdirSync(output, { recursive: true })
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1472, height: 932 })
  await page.goto(pathToFileURL(source).href)
  const frame = page.frameLocator('iframe')
  await expect(frame.locator('#flashie-today-directions[data-concept="orbital"]')).toBeVisible()
  await frame.locator('.viz-controls, .ftd-caption, .ftd-approval, .ftd-selection').evaluateAll((items) => items.forEach((item) => (item as HTMLElement).style.display = 'none'))
  await page.locator('iframe').screenshot({ path: join(output, 'reference.png') })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.locator('[data-testid="today-orbital-command"]')).toBeVisible()
  await page.screenshot({ path: join(output, 'implementation.png') })

  const reference = fileData(join(output, 'reference.png'))
  const implementation = fileData(join(output, 'implementation.png'))
  await page.setViewportSize({ width: 2880, height: 928 })
  await page.setContent('<style>html,body{margin:0;overflow:hidden;background:#fff}canvas{display:block}</style><canvas id="canvas" width="2880" height="928"></canvas>')
  await page.evaluate(async ({ reference, implementation }) => {
    const load = (src: string) => new Promise<HTMLImageElement>((done, fail) => { const image = new Image(); image.onload = () => done(image); image.onerror = fail; image.src = src })
    const [left, right] = await Promise.all([load(reference), load(implementation)])
    const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!; const context = canvas.getContext('2d')!
    context.fillStyle = '#fff'; context.fillRect(0, 0, 2880, 928); context.fillStyle = '#1a1c1f'; context.font = '500 14px system-ui'
    context.fillText('Approved reference · A Orbital Command · 1440×900', 8, 19); context.fillText('Actual production HomePage · deterministic fixture', 1448, 19)
    context.drawImage(left, 0, 28); context.drawImage(right, 1440, 28)
  }, { reference, implementation })
  await page.locator('#canvas').screenshot({ path: join(output, 'contact-sheet.png') })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.setContent('<style>html,body{margin:0;overflow:hidden;background:#fff}canvas{display:block}</style><canvas id="canvas" width="1440" height="900"></canvas>')
  const metric = await page.evaluate(async ({ reference, implementation }) => {
    const load = (src: string) => new Promise<HTMLImageElement>((done, fail) => { const image = new Image(); image.onload = () => done(image); image.onerror = fail; image.src = src })
    const [left, right] = await Promise.all([load(reference), load(implementation)])
    const a = document.createElement('canvas'); const b = document.createElement('canvas'); a.width = b.width = 1440; a.height = b.height = 900
    a.getContext('2d')!.drawImage(left, 0, 0); b.getContext('2d')!.drawImage(right, 0, 0)
    const expected = a.getContext('2d')!.getImageData(0, 0, 1440, 900); const actual = b.getContext('2d')!.getImageData(0, 0, 1440, 900)
    const output = document.querySelector<HTMLCanvasElement>('#canvas')!; const heat = output.getContext('2d')!.createImageData(1440, 900); let changed = 0
    for (let index = 0; index < expected.data.length; index += 4) { const delta = Math.max(...[0, 1, 2, 3].map((offset) => Math.abs(expected.data[index + offset] - actual.data[index + offset]))); if (delta > 10) { changed++; heat.data.set([235, 48, 48, 255], index) } else { const grey = Math.round((actual.data[index] + actual.data[index + 1] + actual.data[index + 2]) / 12); heat.data.set([grey, grey, grey, 255], index) } }
    output.getContext('2d')!.putImageData(heat, 0, 0)
    return { viewport: '1440x900', antiAliasingThreshold: 10, changedPixels: changed, totalPixels: 1296000, changedPixelPercentage: Number((changed * 100 / 1296000).toFixed(4)) }
  }, { reference, implementation })
  await page.locator('#canvas').screenshot({ path: join(output, 'pixel-diff-heatmap.png') })
  writeFileSync(join(output, 'pixel-diff.json'), `${JSON.stringify(metric, null, 2)}\n`)
})
