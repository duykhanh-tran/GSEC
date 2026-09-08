import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATED_TASK_CODES } from '../../src/app/registry'

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [path]
  })
}

describe('locked React architecture contract', () => {
  it('keeps task content free of imperative HTML and global DOM control', () => {
    const files = filesUnder(resolve('src/tasks')).filter((file) => /\.(ts|tsx)$/.test(file))
    const source = files.map((file) => readFileSync(file, 'utf8')).join('\n')
    expect(source).not.toMatch(/dangerouslySetInnerHTML|\.innerHTML|insertAdjacentHTML|document\.write|document\.querySelector/)
  })

  it('keeps Foundation avatar, row and bubble selectors out of task CSS', () => {
    const files = filesUnder(resolve('src/tasks')).filter((file) => file.endsWith('.css'))
    for (const file of files) {
      const css = readFileSync(file, 'utf8')
      expect(css, file).not.toMatch(/\.task-\d+\s+\.(ui-avatar|chat-row|chat-bubble(?:--tutor|--student)?)(?![\w-])/)
    }
  })

  it('routes migrated tasks through the shared task renderer', () => {
    for (const code of MIGRATED_TASK_CODES) {
      const source = readFileSync(resolve(`src/tasks/${code}/Task${code}.tsx`), 'utf8')
      expect(source).toMatch(/<(?:TaskRenderer|GuidedChoiceTask|ListeningChoiceTask)/)
      expect(source).not.toContain('<InteractiveTaskFrame')
      expect(source).not.toContain('<CodeKeypadModal')
      expect(source).not.toContain('<TutorHeader')
    }
  })

  it('keeps the shared renderer as the only task-engine owner of the interactive frame', () => {
    const source = readFileSync(resolve('src/task-engine/TaskRenderer.tsx'), 'utf8')
    expect(source).toContain('<InteractiveTaskFrame')
  })

  it('keeps application Back navigation out of every shared task header', () => {
    const header = readFileSync(resolve('src/components/shell/TutorHeader.tsx'), 'utf8')
    const frame = readFileSync(resolve('src/components/shell/InteractiveTaskFrame.tsx'), 'utf8')
    const foundation = readFileSync(resolve('src/app/pages/FoundationTaskPage.tsx'), 'utf8')
    expect(header).not.toMatch(/onBack|aria-label="Back"|className="back"/)
    expect(frame).not.toContain('navigate(-1)')
    expect(foundation).not.toContain('navigate(-1)')
  })

  it('routes reusable task-family engines through TaskRenderer', () => {
    const source = readFileSync(resolve('src/components/assessment/GuidedChoiceTask.tsx'), 'utf8')
    expect(source).toContain('<TaskRenderer')
    expect(source).not.toContain('<InteractiveTaskFrame')
    const listeningSource = readFileSync(resolve('src/components/assessment/ListeningChoiceTask.tsx'), 'utf8')
    expect(listeningSource).toContain('<GuidedChoiceTask')
    expect(listeningSource).not.toContain('<InteractiveTaskFrame')
  })

  it('keeps confirmed worksheet-choice retries Book-first', () => {
    for (const code of ['60122', '60132']) {
      const source = readFileSync(resolve(`src/tasks/${code}/data.tsx`), 'utf8')
      expect(source, code).toContain('Open your worksheet and reread')
      expect(source, code).not.toMatch(/retryContent|className="(?:question|option-text)"/)
    }
  })
})
