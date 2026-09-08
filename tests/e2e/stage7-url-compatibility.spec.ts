import { expect, test } from '@playwright/test'
import { ALL_TASK_CODES } from '../task-codes'

test.skip(process.env.STATIC_E2E !== 'true', 'Runs only against the strict static build server.')

test.beforeEach(async ({ page }) => {
  await page.route('https://dl.dropboxusercontent.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'image/gif',
    body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64'),
  }))
})

test('all canonical and legacy task URLs are physical static entry points', async ({ page, request }) => {
  test.setTimeout(120_000)
  for (const code of ALL_TASK_CODES) {
    const canonicalResponse = await request.get(`/tasks/${code}`)
    expect(canonicalResponse.status()).toBe(200)
    const legacyResponse = await request.get(`/tasks/${code}/index.html`)
    expect(legacyResponse.status()).toBe(200)

    await page.goto(`/tasks/${code}`)
    await expect(page.locator(`[data-task='${code}']`)).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/tasks/${code}$`))

    await page.reload()
    await expect(page.locator(`[data-task='${code}']`)).toBeVisible()

    await page.goto(`/tasks/${code}/index.html`)
    await expect(page.locator(`[data-task='${code}']`)).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/tasks/${code}$`))
  }
})

test('query URLs resolve through the registry and invalid URLs remain recoverable', async ({ page, request }) => {
  test.setTimeout(90_000)
  for (const code of ALL_TASK_CODES) {
    await page.goto(`/?page=${code}`)
    await expect(page.locator(`[data-task='${code}']`)).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/tasks/${code}$`))
  }

  await page.goto('/?page=99999')
  await expect(page.getByRole('alert')).toHaveText('Không tìm thấy task có mã 99999.')

  const missingResponse = await request.get('/tasks/99999')
  expect(missingResponse.status()).toBe(404)
  await page.goto('/tasks/99999')
  await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible()
  await expect(page.getByText('Không tìm thấy task có mã 99999.')).toBeVisible()

  const unrelatedResponse = await request.get('/not-a-real-route')
  expect(unrelatedResponse.status()).toBe(404)
})

test('keypad navigation participates correctly in Back, Forward and refresh history', async ({ page }) => {
  await page.goto('/')
  for (const digit of '60111') await page.getByRole('button', { name: `Số ${digit}` }).click()
  await expect(page).toHaveURL(/\/tasks\/60111$/)

  await page.getByRole('button', { name: 'Open number keypad' }).click()
  await page.keyboard.type('60112')
  await expect(page).toHaveURL(/\/tasks\/60112$/)

  await page.goBack()
  await expect(page).toHaveURL(/\/tasks\/60111$/)
  await expect(page.locator("[data-task='60111']")).toBeVisible()

  await page.goForward()
  await expect(page).toHaveURL(/\/tasks\/60112$/)
  await page.reload()
  await expect(page.locator("[data-task='60112']")).toBeVisible()
})
