import { expect, test } from '@playwright/test'

let runtimeErrors: string[]

test.beforeEach(async ({ page }) => {
  runtimeErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  await page.route('https://dl.dropboxusercontent.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/gif',
      body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64'),
    }),
  )
})

test.afterEach(() => {
  expect(runtimeErrors).toEqual([])
})

test('inline keypad opens a registered task and preserves foundation styles', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'AI Tutor · WS 1' })).toBeVisible()
  await expect(page.locator('.pin-slot')).toHaveCount(5)

  for (const digit of ['6', '0', '1', '5', '4']) {
    await page.getByRole('button', { name: `Số ${digit}` }).click()
  }

  await expect(page).toHaveURL(/\/tasks\/60154$/)
  await expect(page.getByRole('heading', { name: 'AI Tutor • WS 5 - Task 4' })).toBeVisible()

  const avatar = page.locator('.topbar .ui-avatar')
  await expect(avatar).toHaveCSS('width', '34px')
  await expect(avatar).toHaveCSS('height', '34px')

  const bubble = page.locator('.chat-bubble--tutor')
  await expect(bubble).toHaveCSS('background-color', 'rgb(241, 245, 249)')
  await expect(bubble).toHaveCSS('border-radius', '17px 17px 17px 5px')
  await expect(bubble).toHaveCSS('font-size', '14px')

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  )

  await page.setViewportSize({ width: 1024, height: 900 })
  await page.reload()
  await expect(page.locator('.task .app')).toHaveCSS('max-width', '480px')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  )
})

test('modal keypad reports invalid codes and restores focus', async ({ page }) => {
  await page.goto('/tasks/60111')
  const trigger = page.getByRole('button', { name: 'Open number keypad' })
  await trigger.click()

  const dialog = page.getByRole('dialog', { name: 'Nhập mã task' })
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('button', { name: 'Số 1' })).toBeFocused()
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')

  await page.keyboard.type('99999')
  await expect(page.getByRole('alert')).toHaveText('Không tìm thấy task có mã 99999.')

  await page.getByRole('button', { name: 'Đóng bàn phím' }).click()
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
})

test('query and legacy routes resolve through the shared registry', async ({ page }) => {
  await page.goto('/?page=60131')
  await expect(page).toHaveURL(/\/tasks\/60131$/)

  await page.goto('/tasks/60155/index.html')
  await expect(page).toHaveURL(/\/tasks\/60155$/)

  await page.goto('/?page=99999')
  await expect(page.getByRole('alert')).toHaveText('Không tìm thấy task có mã 99999.')
})
