import { expect, test, type Locator, type Page } from '@playwright/test'

async function recordAndConfirm(card: Locator) {
  await card.locator('[data-demo]').click()
  await expect(card.locator('[data-yes]')).toBeVisible({ timeout: 4_000 })
  await card.locator('[data-yes]').click()
}

async function choose(page: Page, selector: string, option: string) {
  const card = page.locator(selector)
  await expect(card).toBeVisible()
  await card.locator(`[data-option='${option}']`).click()
}

test.beforeEach(async ({ page }) => {
  await page.route('https://dl.dropboxusercontent.com/**', (route) => route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64') }))
})

test('60141 keeps phrase answers in the worksheet and uses A-D labels', async ({ page }) => {
  await page.goto('/tasks/60141')
  await expect(page.locator("[data-stage='entry'] thead th:not(:first-child)")).toHaveText(['A', 'B', 'C', 'D'])
  await expect(page.locator("[data-stage='entry']")).not.toContainText('Nice to meet you')
  await page.locator('[data-demo]').click()
  await page.locator('[data-check]').click()
  await choose(page, "[data-stage='retry'][data-blank='2'][data-attempt='1']", 'A')
  await choose(page, "[data-stage='retry'][data-blank='2'][data-attempt='2']", 'B')
  await choose(page, "[data-stage='retry'][data-blank='3'][data-attempt='1']", 'C')
  await expect(page.locator("[data-stage='complete']")).toBeVisible()
  await expect(page.locator("[data-stage='complete']")).not.toContainText('Nice to meet you')
  await expect(page.locator('#backBook')).toBeEnabled()
})

test('60142 preserves A/B/C retry flow', async ({ page }) => {
  await page.goto('/tasks/60142')
  await page.locator('[data-demo]').click()
  await page.locator('[data-check]').click()
  await choose(page, "[data-stage='retry'][data-question='2'][data-attempt='1']", 'B')
  await choose(page, "[data-stage='retry'][data-question='2'][data-attempt='2']", 'A')
  await choose(page, "[data-stage='retry'][data-question='4'][data-attempt='1']", 'B')
  await choose(page, "[data-stage='retry'][data-question='5'][data-attempt='1']", 'A')
  await expect(page.locator("[data-stage='complete']")).toBeVisible()
})

test('60143 preserves transcript confirmation, repair, and four-turn completion', async ({ page }) => {
  await page.goto('/tasks/60143')
  for (const turn of [1, 2]) {
    const card = page.locator(`[data-stage='turn'][data-turn='${turn}'][data-attempt='1']`)
    await recordAndConfirm(card)
    await card.locator('[data-use]').click()
  }
  for (const turn of [3, 4]) {
    let card = page.locator(`[data-stage='turn'][data-turn='${turn}'][data-attempt='1']`)
    await recordAndConfirm(card)
    await expect(card.locator('.gate.warn')).toBeVisible()
    await card.locator('[data-model]').click()
    await expect(card.locator('.model')).toBeVisible()
    await card.locator('[data-retry]').click()
    card = page.locator(`[data-stage='turn'][data-turn='${turn}'][data-attempt='2']`)
    await recordAndConfirm(card)
    await card.locator('[data-use]').click()
  }
  await expect(page.locator("[data-stage='complete']")).toBeVisible()
  await expect(page.locator("[data-stage='complete'] [data-learning-mode='guided']")).toHaveCount(2)
  await expect(page.locator('#backBook')).toBeEnabled()
})

test('60144 records model-supported completion as Guided, not mastery', async ({ page }) => {
  await page.goto('/tasks/60144')
  for (const stage of ['greet', 'question', 'introduce']) {
    let card = page.locator(`[data-stage='${stage}'][data-retry='false']`)
    await recordAndConfirm(card)
    await expect(card.locator('.gate.warn')).toBeVisible()
    await card.locator('[data-model]').click()
    await card.locator('[data-retry]').click()
    card = page.locator(`[data-stage='${stage}'][data-retry='true']`)
    await recordAndConfirm(card)
    await expect(card.locator('.gate.ok')).toBeVisible()
    await card.locator('[data-next]').click()
  }
  const summary = page.locator("[data-stage='complete']")
  await expect(summary).toBeVisible()
  await expect(summary.getByText('Guided completion')).toBeVisible()
  await expect(summary.locator("[data-learning-mode='guided']")).toBeVisible()
  await expect(page.locator("[data-mastery='pending']")).toContainText('Guided completion')
  await expect(page.getByText('Mastery reached ✓')).toHaveCount(0)
  await expect(page.locator('#doneBtn')).toBeEnabled()
})
