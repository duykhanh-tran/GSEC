import { expect, test } from '@playwright/test'

for (const code of ['60154', '60131', '60155']) {
  test(`${code} has no horizontal overflow on mobile and desktop`, async ({ page }) => {
    await page.route('https://dl.dropboxusercontent.com/**', (route) => route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64') }))
    for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 900 }]) {
      await page.setViewportSize(viewport)
      await page.goto(`/tasks/${code}`)
      await expect(page.locator(`[data-task='${code}']`)).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth))
      await expect(page.locator('.app')).toHaveCSS('max-width', '480px')
      await expect(page.locator('.topbar .ui-avatar')).toHaveCSS('width', '34px')
    }
  })
}
