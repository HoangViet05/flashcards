import { expect, test } from '@playwright/test'

for (const width of [320, 390, 768, 1440]) {
  test(`login page fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/login')
    expect(await page.locator('body').evaluate(element => element.scrollWidth <= window.innerWidth)).toBeTruthy()
  })
}
