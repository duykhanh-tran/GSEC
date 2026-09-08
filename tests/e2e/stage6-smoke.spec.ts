import { expect, test } from '@playwright/test'
import { MIGRATED_TASK_CODES } from '../task-codes'

test.beforeEach(async ({ page }) => { await page.route('https://dl.dropboxusercontent.com/**', (route) => route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64') })) })

test('all migrated routes render a registered React task without placeholder content', async ({ page }) => {
  test.setTimeout(90_000)
  for (const code of MIGRATED_TASK_CODES) {
    await page.goto(`/tasks/${code}`)
    const root = page.locator(`[data-task='${code}'][data-module-ready='true']`)
    await expect(root).toBeVisible()
    await expect(root).not.toContainText('will be replaced during the task migration stages')
    await expect(page.locator('.topbar .back')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0)
  }
})

test('all migrated task shells avoid horizontal overflow at desktop and mobile widths', async ({ page }) => {
  test.setTimeout(120_000)
  for (const code of MIGRATED_TASK_CODES) {
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.goto(`/tasks/${code}`)
    await expect(page.locator(`[data-task='${code}']`)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  }
})
