import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { MIGRATED_TASK_CODES } from '../task-codes'

const PROFILES = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1024, height: 900 },
} as const
const HTML_BASE_URL = process.env.HTML_BASE_URL ?? 'http://127.0.0.1:4173'
const REACT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4176'
const outputRoot = join(process.cwd(), 'reports', 'stage-8-visual')
const HTML_PARITY_TASK_CODES = MIGRATED_TASK_CODES.filter((code) => Number(code) < 60160)
const CONTENT_RECALL_THRESHOLDS: Readonly<Record<string, number>> = {
  // React intentionally removes the phrase-answer bank exposed by the legacy HTML.
  '60141': 0.65,
}

test.skip(process.env.PARITY_E2E !== 'true', 'Runs only with both HTML and React parity servers.')

function normalize(value: string) {
  return value.toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function tokenRecall(source: string, target: string) {
  const sourceTokens = new Set(normalize(source).split(' ').filter(Boolean))
  const targetTokens = new Set(normalize(target).split(' ').filter(Boolean))
  const matches = [...sourceTokens].filter((token) => targetTokens.has(token)).length
  return sourceTokens.size ? matches / sourceTokens.size : 1
}

async function pageState(page: import('@playwright/test').Page, code: string) {
  return page.evaluate((taskCode) => {
    const root = document.querySelector(`[data-task='${taskCode}']`)
    const app = root?.querySelector('.app')
    const avatar = root?.querySelector('.ui-avatar')
    const tutorBubble = root?.querySelector('.chat-bubble--tutor')
    const style = (element: Element | null | undefined, keys: string[]) => {
      if (!element) return null
      const computed = getComputedStyle(element)
      return Object.fromEntries(keys.map((key) => [key, computed.getPropertyValue(key)]))
    }
    return {
      title: document.title,
      heading: root?.querySelector('.topbar h1, .top h1')?.textContent?.trim() ?? '',
      subtitle: root?.querySelector('.topbar .meta p, .top .meta p')?.textContent?.trim() ?? '',
      text: document.body.innerText.replace(/\s+/g, ' ').trim(),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      appWidth: app ? Number(app.getBoundingClientRect().width.toFixed(2)) : null,
      avatar: style(avatar, ['width', 'height', 'border-radius']),
      tutorBubble: style(tutorBubble, ['background-color', 'color', 'font-family', 'font-size', 'line-height', 'padding', 'border-radius']),
    }
  }, code)
}

test('WS1-WS5 tasks retain HTML content and Foundation presentation at both target viewports', async ({ browser }) => {
  test.setTimeout(240_000)
  const errors: Array<{ profile: string; code: string; surface: string; message: string }> = []
  const parityIssues: string[] = []
  const results: Array<Record<string, unknown>> = []

  for (const [profile, viewport] of Object.entries(PROFILES)) {
    const profileDirectory = join(outputRoot, profile)
    await mkdir(profileDirectory, { recursive: true })
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
    const htmlPage = await context.newPage()
    const reactPage = await context.newPage()
    for (const [surface, page] of [['html', htmlPage], ['react', reactPage]] as const) {
      page.on('pageerror', (error) => errors.push({ profile, code: 'runtime', surface, message: error.message }))
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push({ profile, code: 'console', surface, message: message.text() })
      })
      await page.route('https://dl.dropboxusercontent.com/**', (route) => route.fulfill({
        status: 200,
        contentType: 'image/gif',
        body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64'),
      }))
    }

    await reactPage.goto(REACT_BASE_URL)
    await expect(reactPage.locator('.pin-slot')).toHaveCount(5)
    await reactPage.screenshot({ path: join(profileDirectory, 'index.png'), animations: 'disabled' })

    for (const code of HTML_PARITY_TASK_CODES) {
      await htmlPage.goto(`${HTML_BASE_URL}/tasks/${code}/index.html`)
      await htmlPage.locator(`[data-task='${code}'][data-module-ready='true']`).waitFor()
      await reactPage.goto(`${REACT_BASE_URL}/tasks/${code}`)
      await reactPage.locator(`[data-task='${code}'][data-module-ready='true']`).waitFor()

      const html = await pageState(htmlPage, code)
      const react = await pageState(reactPage, code)
      const recall = tokenRecall(html.text, react.text)
      const recallThreshold = CONTENT_RECALL_THRESHOLDS[code] ?? 0.72

      if (normalize(react.heading) !== normalize(html.heading)) parityIssues.push(`${profile} ${code}: heading '${react.heading}' != '${html.heading}'`)
      if (normalize(react.subtitle) !== normalize(html.subtitle)) parityIssues.push(`${profile} ${code}: subtitle '${react.subtitle}' != '${html.subtitle}'`)
      if (recall < recallThreshold) parityIssues.push(`${profile} ${code}: initial content token recall ${recall.toFixed(4)} < ${recallThreshold.toFixed(2)}`)
      if (react.overflow) parityIssues.push(`${profile} ${code}: horizontal overflow`)
      if (react.appWidth === null || react.appWidth > 480) parityIssues.push(`${profile} ${code}: shell width ${react.appWidth}`)
      if (JSON.stringify(react.avatar) !== JSON.stringify({ width: '34px', height: '34px', 'border-radius': '50%' })) parityIssues.push(`${profile} ${code}: avatar style mismatch`)
      if (react.tutorBubble) {
        const expectedTutorBubble = {
          'background-color': 'rgb(241, 245, 249)',
          color: 'rgb(24, 33, 47)',
          'font-family': 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          'font-size': '14px',
          'line-height': '20.3px',
          padding: '10px 12px',
          'border-radius': '17px 17px 17px 5px',
        }
        if (JSON.stringify(react.tutorBubble) !== JSON.stringify(expectedTutorBubble)) parityIssues.push(`${profile} ${code}: tutor bubble style mismatch`)
      }

      await reactPage.screenshot({ path: join(profileDirectory, `${code}.png`), animations: 'disabled' })
      results.push({ profile, code, viewport, contentTokenRecall: Number(recall.toFixed(4)), contentTokenRecallThreshold: recallThreshold, html, react })
    }
    await context.close()
  }

  await writeFile(join(outputRoot, 'parity-metrics.json'), `${JSON.stringify({
    createdAt: new Date().toISOString(),
    htmlBaseUrl: HTML_BASE_URL,
    reactBaseUrl: REACT_BASE_URL,
    profiles: PROFILES,
    intentionalContentExceptions: {
      '60141': 'React omits the legacy phrase-answer bank to comply with BOOK-FIRST-CONTENT-STANDARD.md.',
    },
    taskCount: HTML_PARITY_TASK_CODES.length,
    screenshotCount: HTML_PARITY_TASK_CODES.length * Object.keys(PROFILES).length + Object.keys(PROFILES).length,
    errors,
    parityIssues,
    results,
  }, null, 2)}\n`, 'utf8')
  expect(errors, 'runtime errors').toEqual([])
  expect(parityIssues, 'HTML/React parity issues').toEqual([])
})
