import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('https://dl.dropboxusercontent.com/**', (route) => route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64') }))
  await page.addInitScript(() => {
    class MockSpeechSynthesisUtterance {
      text: string
      lang = ''
      rate = 1
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor(text: string) { this.text = text }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: MockSpeechSynthesisUtterance })
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel() {}, speak(utterance: MockSpeechSynthesisUtterance) { window.setTimeout(() => utterance.onend?.(), 10) } } })
  })
})

async function completePlayback(page: Page) {
  const playback = page.locator("[data-stage='playback']")
  await playback.getByRole('button', { name: 'Play' }).click()
  await expect(playback).toHaveAttribute('data-playback-complete', 'true')
}

async function chooseRetry(page: Page, selector: string, answer: string) {
  const retry = page.locator(selector)
  await expect(retry).toBeVisible()
  await retry.locator(`[data-option='${answer}']`).click()
}

async function recordAndConfirm(page: Page, selector: string) {
  const card = page.locator(selector)
  await expect(card).toBeVisible()
  await card.locator('[data-demo]').click()
  await expect(card.locator('.transcript')).toBeVisible({ timeout: 5_000 })
  await card.locator('[data-confirm]').click()
}

test('60161 preserves full-listening gate, T/F retries and evidence', async ({ page }) => {
  await page.goto('/tasks/60161')
  await expect(page.locator("[data-stage='entry']")).toHaveCount(0)
  await expect(page.getByText('Listen to Emily’s full talk first. Then complete the True/False statements in your worksheet.')).toBeVisible()
  await expect(page.getByText('Normal speed • one full play')).toBeVisible()
  await completePlayback(page)
  await page.locator('[data-demo]').last().click()
  await page.locator('[data-check]').click()
  await expect(page.getByText(/Items\s+2, 3, 4\s+need another look/)).toBeVisible()
  await expect(page.locator("[data-stage='retry'] [data-listen]")).toBeVisible()
  await chooseRetry(page, "[data-stage='retry'][data-question='2']", 'F')
  await chooseRetry(page, "[data-stage='retry'][data-question='3']", 'F')
  await chooseRetry(page, "[data-stage='retry'][data-question='4']", 'T')
  await expect(page.locator("[data-stage='complete']")).toBeVisible()
  await expect(page.locator("[data-stage='complete']").getByText('Independent ✓', { exact: true })).toHaveCount(5)
})

test('60162 preserves full replay, A/B/C retries and main-idea evidence', async ({ page }) => {
  await page.goto('/tasks/60162')
  await expect(page.getByText('Normal speed • one full replay')).toBeVisible()
  await completePlayback(page)
  await page.locator('[data-demo]').last().click()
  await page.locator('[data-check]').click()
  await chooseRetry(page, "[data-stage='retry'][data-question='2']", 'C')
  await chooseRetry(page, "[data-stage='retry'][data-question='3']", 'A')
  await chooseRetry(page, "[data-stage='retry'][data-question='4']", 'B')
  await chooseRetry(page, "[data-stage='retry'][data-question='5']", 'A')
  await expect(page.locator("[data-stage='complete']")).toContainText('LISTEN-MAIN-IDEA')
  await expect(page.locator('#backBook')).toBeEnabled()
})

test('60163 preserves five STT sentence checks and Guided model evidence', async ({ page }) => {
  await page.goto('/tasks/60163')
  await expect(page.locator('.progress-steps--segments .progress-step')).toHaveCount(5)
  await recordAndConfirm(page, "[data-stage='sentence-recording'][data-turn='1']")
  await page.locator("[data-turn='1'] [data-use]").click()

  await recordAndConfirm(page, "[data-stage='sentence-recording'][data-turn='2'][data-attempt='1']")
  await page.locator("[data-turn='2'] [data-model]").click()
  await expect(page.getByText('This sentence will be marked Guided.')).toBeVisible()
  await page.locator("[data-turn='2'] [data-retry]").click()
  await recordAndConfirm(page, "[data-stage='sentence-recording'][data-turn='2'][data-attempt='2']")
  await page.locator("[data-turn='2'] [data-use]").click()

  await recordAndConfirm(page, "[data-stage='sentence-recording'][data-turn='3']")
  await page.locator("[data-turn='3'] [data-use]").click()
  await recordAndConfirm(page, "[data-stage='sentence-recording'][data-turn='4'][data-attempt='1']")
  await page.locator("[data-turn='4'] [data-retry]").click()
  await recordAndConfirm(page, "[data-stage='sentence-recording'][data-turn='4'][data-attempt='2']")
  await page.locator("[data-turn='4'] [data-use]").click()
  await recordAndConfirm(page, "[data-stage='sentence-recording'][data-turn='5']")
  await page.locator("[data-turn='5'] [data-use]").click()

  const summary = page.locator("[data-stage='complete']")
  await expect(summary).toBeVisible()
  await expect(summary.getByText('Guided', { exact: true })).toHaveCount(1)
  await expect(summary).toContainText('pronunciation is not scored')
})

test('60164 preserves fixed position, link repair and Guided model', async ({ page }) => {
  await page.goto('/tasks/60164')
  await expect(page.locator("[data-slot='0']")).toBeDisabled()
  await expect(page.locator("[data-stage='retry']")).toHaveCount(0)
  await page.locator('[data-demo]').click()
  await page.locator('[data-check]').click()
  await chooseRetry(page, "[data-stage='retry'][data-position='2'][data-attempt='1']", '1')
  await chooseRetry(page, "[data-stage='retry'][data-position='2'][data-attempt='2']", '1')
  const retry = page.locator("[data-stage='retry'][data-position='2'][data-attempt='3']")
  await retry.locator('[data-show-model]').click()
  await expect(retry).toContainText('4 – 2 – 5 – 1 – 3')
  await expect(page.locator("[data-stage='complete']")).toContainText('Guided')
})

test('60165 preserves worksheet guide, missing-item validation and readiness', async ({ page }) => {
  await page.goto('/tasks/60165')
  await expect(page.getByText('I like … because …')).toBeVisible()
  await page.locator('[data-ready]').click()
  await page.locator('[data-demo-check]').click()
  await page.locator('[data-confirm]').click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.locator("[data-checklist-item='like']").click()
  await page.locator('[data-confirm]').click()
  await expect(page.locator("[data-stage='complete']")).toBeVisible()
  await expect(page.locator('#nextBtn')).toBeEnabled()
})

test('60166 preserves writing feedback, book verification, revision and mastery', async ({ page }) => {
  await page.goto('/tasks/60166')
  await recordAndConfirm(page, "[data-stage='first-recording']")
  await page.locator("[data-stage='first-feedback'] [data-next]").click()
  await page.locator("[data-stage='verification'] [data-save]").click()
  await expect(page.getByRole('alert')).toContainText('Complete the short book check')
  for (const id of ['caps', 'endmark', 'spelling']) await page.locator(`[data-verification-item='${id}']`).check()
  await page.getByRole('textbox', { name: 'Type one checked word' }).fill('friendly')
  await page.locator("[data-stage='verification'] [data-save]").click()
  await page.locator("[data-stage='revision'] [data-ready]").click()
  await recordAndConfirm(page, "[data-stage='revised-recording']")
  await expect(page.locator("[data-stage='revised-feedback']")).toContainText('10/10')
  await page.locator("[data-stage='revised-feedback'] [data-result]").click()
  await expect(page.locator("[data-stage='complete']")).toContainText('Mastery ✓')
  await expect(page.locator('#finishBtn')).toBeEnabled()
})
