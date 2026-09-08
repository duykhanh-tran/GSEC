import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('https://dl.dropboxusercontent.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64') }),
  )
  await page.goto('/tasks/60154')
})

test('60154 preserves readiness validation, completion and keypad', async ({ page }) => {
  await expect(page.locator(".task-60154[data-module-ready='true']")).toBeVisible()
  await page.locator('[data-ready]').click()
  await expect(page.getByText('School chosen, One fact from the text, Why it is good for you, One activity you would like to do')).toBeVisible()
  await page.locator('[data-demo]').click()
  await page.locator('[data-ready]').click()
  await expect(page.getByText('One activity you would like to do', { exact: true }).last()).toBeVisible()
  await expect(page.locator('[data-plan-warning]')).toBeVisible()
  await page.locator("[data-plan-id='activity']").click()
  await expect(page.locator('[data-ready]')).toHaveText('I’m ready')
  await page.locator("[data-plan-id='reason']").click()
  await page.locator('[data-ready]').click()
  await expect(page.getByText('Why it is good for you', { exact: true }).last()).toBeVisible()
  await page.locator("[data-plan-id='reason']").click()
  await page.locator('[data-ready]').click()
  await expect(page.locator("[data-stage='complete']")).toBeVisible()
  await expect(page.locator('.tag.ok')).toHaveCount(4)
  await expect(page.locator('#backBook')).toBeEnabled()
  await page.locator('#backBook').click()
  await expect(page.getByText('Task 5 starts with your 30–45 second talk.')).toBeVisible()
  await page.locator('[aria-label="Open number keypad"]').click()
  await expect(page.locator('.pin-slot')).toHaveCount(5)
})
