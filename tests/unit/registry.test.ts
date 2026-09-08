import { describe, expect, it } from 'vitest'

import {
  DEFAULT_TASK_CODE,
  MIGRATED_TASK_CODES,
  TASK_CODES,
  TASKS,
  getTask,
  getTaskPath,
  hasTask,
  normalizeTaskCode,
} from '../../src/app/registry'

describe('task registry', () => {
  it('contains 32 unique five-digit task codes, including migrated WS6 tasks', () => {
    expect(TASKS).toHaveLength(32)
    expect(TASK_CODES).toHaveLength(32)
    expect(MIGRATED_TASK_CODES).toHaveLength(32)
    expect(new Set(TASK_CODES).size).toBe(32)
    expect(TASK_CODES.every((code) => /^\d{5}$/.test(code))).toBe(true)
    expect(TASK_CODES.slice(-6)).toEqual(['60161', '60162', '60163', '60164', '60165', '60166'])
  })

  it('keeps the complete metadata and routing contract', () => {
    expect(DEFAULT_TASK_CODE).toBe('60111')
    expect(getTask(' 60154 ')).toMatchObject({
      code: '60154',
      worksheet: 5,
      taskNumber: 4,
      title: 'AI Tutor • WS 5 - Task 4',
      legacyUrl: '/tasks/60154/index.html',
    })
    expect(getTaskPath('60154')).toBe('/tasks/60154')
    expect(getTask('60166')).toMatchObject({ worksheet: 6, taskNumber: 6, status: 'migrated' })
    expect(getTaskPath('60166')).toBe('/tasks/60166')
    expect(hasTask('99999')).toBe(false)
    expect(normalizeTaskCode(null)).toBe('')
  })

  it('keeps every migrated task on a real implementation', () => {
    expect(TASKS.filter((task) => task.status === 'migrated').every((task) => task.component.name !== 'FoundationTaskPage')).toBe(true)
    expect(TASKS.filter((task) => task.status === 'planned')).toHaveLength(0)
  })
})
