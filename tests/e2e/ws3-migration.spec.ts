import { expect, test, type Locator, type Page } from '@playwright/test'

async function choose(page: Page, selector: string, option: string) {
  const card = page.locator(selector); await expect(card).toBeVisible(); await card.locator(`[data-option='${option}']`).click()
}
async function record(card: Locator) { await card.locator('[data-demo]').click(); await expect(card.locator('[data-yes]')).toBeVisible({ timeout: 4_000 }); await card.locator('[data-yes]').click() }

test.beforeEach(async ({ page }) => { await page.route('https://dl.dropboxusercontent.com/**', (route) => route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64') })) })

for (const scenario of [
  { code: '60132', wrong: [[2, 'C'], [5, 'C'], [6, 'A']], attr: 'question' },
  { code: '60133', wrong: [[2, 'A'], [3, 'A']], attr: 'question' },
  { code: '60134', wrong: [[2, 'Never'], [3, 'Usually'], [5, 'Sometimes']], attr: 'sentence' },
] as const) {
  test(`${scenario.code} completes its shared answer-and-retry flow`, async ({ page }) => {
    await page.goto(`/tasks/${scenario.code}`); await page.locator('[data-demo]').click(); await page.locator('[data-check]').click()
    for (const [id, answer] of scenario.wrong) {
      const retrySelector = `[data-stage='retry'][data-${scenario.attr}='${id}']`
      if (scenario.code === '60132') {
        const card = page.locator(retrySelector)
        await expect(card).toContainText(`Question ${id}`)
        await expect(card.locator('.question, .option-text')).toHaveCount(0)
        await expect(card.locator('[data-option]')).toHaveCount(3)
      }
      await choose(page, retrySelector, answer)
    }
    await expect(page.locator("[data-stage='complete']")).toBeVisible(); await expect(page.locator('#backBook')).toBeEnabled()
  })
}

test('60135 preserves ASR-versus-writing repair and whole-task self-check', async ({ page }) => {
  await page.goto('/tasks/60135')
  for (const sentence of [1, 2]) { let card = page.locator(`[data-stage='capture'][data-sentence='${sentence}']`); await record(card); card = page.locator(`[data-stage='capture'][data-sentence='${sentence}']`); await card.locator('[data-confirm]').click() }
  let card = page.locator("[data-stage='capture'][data-sentence='3'][data-retry='false']"); await record(card); card = page.locator("[data-stage='capture'][data-sentence='3'][data-retry='false']"); await card.locator('[data-written]').click()
  card = page.locator("[data-stage='capture'][data-sentence='3'][data-retry='true']"); await record(card); card = page.locator("[data-stage='capture'][data-sentence='3'][data-retry='true']"); await card.locator('[data-confirm]').click()
  card = page.locator("[data-stage='capture'][data-sentence='4']"); await record(card); card = page.locator("[data-stage='capture'][data-sentence='4']"); await card.locator('[data-confirm]').click()
  await expect(page.locator("[data-stage='overall']")).toBeVisible(); await page.locator('[data-done]').click(); await expect(page.locator("[data-stage='complete']")).toBeVisible()
})
