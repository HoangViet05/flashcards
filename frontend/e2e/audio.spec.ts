import { expect, test } from '@playwright/test'

test('login does not request static audio before interaction', async ({ page }) => {
  const audioRequests: string[] = []
  page.on('request', request => { if (request.url().includes('/audio/')) audioRequests.push(request.url()) })
  await page.goto('/login')
  await expect.poll(() => audioRequests).toEqual([])
})
