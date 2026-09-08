import { describe, expect, it } from 'vitest'

import { TASK_CODES } from '../../src/app/registry'
import { TASK_AUTHORING_SCHEMAS } from '../../src/task-engine/catalog'

describe('task archetype catalog', () => {
  it('classifies every task exactly once in the authoring catalog', () => {
    expect(Object.keys(TASK_AUTHORING_SCHEMAS).sort()).toEqual([...TASK_CODES].sort())
    for (const code of TASK_CODES) {
      expect(TASK_AUTHORING_SCHEMAS[code].code).toBe(code)
      expect(TASK_AUTHORING_SCHEMAS[code].archetypes.length).toBeGreaterThan(0)
    }
  })

  it('covers the three pilot families', () => {
    expect(TASK_AUTHORING_SCHEMAS['60131'].archetypes).toContain('retry-coaching')
    expect(TASK_AUTHORING_SCHEMAS['60154'].archetypes).toEqual(['readiness-checklist'])
    expect(TASK_AUTHORING_SCHEMAS['60155'].archetypes).toContain('speech-recording')
  })
})
