import { expect, test } from '@playwright/test'

test('login has a keyboard-visible primary action', async ({ page }) => {
  await page.goto('/login')
  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).toBeVisible()
})
