import { expect, test, type Page } from '@playwright/test'

async function transcribe(page: Page, stage: string, expectedText: string) {
  const section = page.locator(`[data-stage='${stage}']`)
  await expect(section).toBeVisible()
  await section.locator('[data-demo]').click()
  await expect(section.getByText(expectedText, { exact: false })).toBeVisible()
  return section
}

test('60155 preserves three recordings, confirmation, revision and mastery', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.route('https://dl.dropboxusercontent.com/**', (route) => route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64') }))
  await page.goto('/tasks/60155')
  await expect(page.locator(".task-60155[data-module-ready='true']")).toBeVisible()

  let section = await transcribe(page, 'first-recording', "I'd like to go to Green World School")
  await section.locator('[data-again]').click()
  section = await transcribe(page, 'first-recording', "I'd like to go to Green World School")
  await section.locator('[data-confirm]').click()
  await expect(section.getByText('Needs work')).toBeVisible()
  await section.locator('[data-review]').click()
  await section.locator('[data-next]').click()

  section = await transcribe(page, 'follow-recording', "I'd like to join the art club")
  await section.locator('[data-confirm]').click()
  await expect(section.locator('.tag.ok')).toHaveCount(3)
  await section.locator('[data-next]').click()
  await page.locator("[data-stage='revision-ready'] [data-ready]").click()

  section = await transcribe(page, 'revised-recording', 'meet students from different countries')
  await section.locator('[data-confirm]').click()
  await expect(section.getByText('9/10')).toBeVisible()
  await section.locator('[data-result]').click()
  await expect(page.locator("[data-stage='complete']")).toBeVisible()
  await expect(page.getByText('Mastery ✓')).toBeVisible()
  await expect(page.locator('#finishBtn')).toBeEnabled()
  await page.locator('#finishBtn').click()
  await expect(page.getByText('Great work. You completed WS5.')).toBeVisible()
  await page.locator('[aria-label="Open number keypad"]').click()
  await expect(page.locator('.pin-slot')).toHaveCount(5)
  expect(errors).toEqual([])
})
