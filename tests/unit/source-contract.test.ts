import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('foundation source contract', () => {
  it('keeps the visual tokens inherited from foundation-1', () => {
    const css = readFileSync(resolve('src/styles/tokens.css'), 'utf8')

    expect(css).toContain('--color-primary: #8b0450')
    expect(css).toContain('--chat-avatar-size: 34px')
    expect(css).toContain('--chat-tutor-background: #f1f5f9')
    expect(css).toContain('--chat-student-background: #f9edf3')
    expect(css).toContain('--chat-tutor-radius: 17px 17px 17px 5px')
    expect(css).toContain('--chat-student-radius: 17px 17px 5px 17px')
    expect(css).toContain('--chat-bubble-font-size: 14px')
  })

  it('does not use forbidden imperative HTML APIs', () => {
    const files = [
      'src/app/router.tsx',
      'src/components/keypad/CodeKeypad.tsx',
      'src/app/pages/FoundationTaskPage.tsx',
    ]
    const source = files.map((file) => readFileSync(resolve(file), 'utf8')).join('\n')

    expect(source).not.toMatch(/dangerouslySetInnerHTML|\.innerHTML|insertAdjacentHTML|document\.write/)
  })
})
