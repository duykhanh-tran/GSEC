import { expect, test, type Page } from '@playwright/test'

async function choose(page: Page, selector: string, option: string, expected: string) {
  const card = page.locator(selector)
  await expect(card).toBeVisible()
  await card.locator(`[data-option='${option}']`).click()
  await expect(card.getByText(expected, { exact: false })).toBeVisible()
  return card
}

test.beforeEach(async ({ page }) => {
  await page.route('https://dl.dropboxusercontent.com/**', (route) => route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64') }))
})

test('60151 preserves guided and independent reading retries', async ({ page }) => {
  await page.goto('/tasks/60151')
  await page.locator('[data-check]').click()
  await expect(page.getByText('Choose one summary for all 3 schools first.')).toBeVisible()
  await page.locator('[data-demo]').click()
  await page.locator('[data-check]').click()
  await expect(page.getByText(/Schools\s+1, 3\s+need another look/)).toBeVisible()
  await choose(page, "[data-stage='retry'][data-school='1'][data-attempt='1']", 'A', 'Not yet.')
  await choose(page, "[data-stage='retry'][data-school='1'][data-attempt='2']", 'C', 'Not yet.')
  let card = page.locator("[data-stage='retry'][data-school='1'][data-attempt='3']")
  await card.locator('[data-show]').click()
  await expect(card.getByText('This school is marked Guided')).toBeVisible()
  await choose(page, "[data-stage='retry'][data-school='3'][data-attempt='1']", 'C', 'Not yet.')
  await choose(page, "[data-stage='retry'][data-school='3'][data-attempt='2']", 'B', 'Not yet.')
  card = page.locator("[data-stage='retry'][data-school='3'][data-attempt='3']")
  await card.locator('[data-keep]').click()
  await expect(card.locator('[data-final-actions]')).toHaveCount(0)
  await card.locator("[data-option='A']").click()
  await expect(page.locator("[data-stage='complete']")).toBeVisible()
  await expect(page.locator("[data-stage='complete']").getByText('Independent ✓', { exact: true })).toHaveCount(2)
})

test('60152 preserves six-answer M1/M2 guided flow', async ({ page }) => {
  await page.goto('/tasks/60152')
  await page.locator('[data-demo]').click()
  await page.locator('[data-check]').click()
  await expect(page.getByText(/Questions\s+2, 4, 5, 6\s+need another look/)).toBeVisible()
  await choose(page, "[data-stage='retry'][data-question='2'][data-attempt='1']", 'C', 'Not yet.')
  await choose(page, "[data-stage='retry'][data-question='2'][data-attempt='2']", 'A', 'Not yet.')
  const card = page.locator("[data-stage='retry'][data-question='2'][data-attempt='3']")
  await card.locator('[data-show]').click()
  await choose(page, "[data-stage='retry'][data-question='4'][data-attempt='1']", 'B', 'Correct ✓')
  await choose(page, "[data-stage='retry'][data-question='5'][data-attempt='1']", 'C', 'Correct ✓')
  await choose(page, "[data-stage='retry'][data-question='6'][data-attempt='1']", 'A', 'Correct ✓')
  await expect(page.locator("[data-stage='complete']")).toBeVisible()
  await expect(page.locator('#backBook')).toBeEnabled()
})

test('60153 preserves six-letter discourse flow', async ({ page }) => {
  await page.goto('/tasks/60153')
  await page.locator('[data-demo]').click()
  await page.locator('[data-check]').click()
  await expect(page.getByText(/Blanks\s+2, 3, 5\s+need another look/)).toBeVisible()
  await choose(page, "[data-stage='retry'][data-blank='2'][data-attempt='1']", 'f', 'Not yet.')
  await choose(page, "[data-stage='retry'][data-blank='2'][data-attempt='2']", 'b', 'Not yet.')
  const card = page.locator("[data-stage='retry'][data-blank='2'][data-attempt='3']")
  await card.locator('[data-show]').click()
  await choose(page, "[data-stage='retry'][data-blank='3'][data-attempt='1']", 'd', 'Correct ✓')
  await choose(page, "[data-stage='retry'][data-blank='5'][data-attempt='1']", 'b', 'Correct ✓')
  await expect(page.locator("[data-stage='complete']")).toBeVisible()
  await expect(page.locator("[data-stage='complete']").getByText('Independent ✓', { exact: true })).toHaveCount(4)
})
