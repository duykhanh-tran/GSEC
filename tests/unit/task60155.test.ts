import { describe, expect, it } from 'vitest'

import { SPEAKING_DEMO } from '../../src/tasks/60155/data'

describe('Task 60155 speaking data contract', () => {
  it('keeps all three distinct transcripts', () => {
    expect(Object.keys(SPEAKING_DEMO)).toEqual(['first', 'follow', 'revised'])
    expect(SPEAKING_DEMO.revised).toContain('meet students from different countries')
    expect(SPEAKING_DEMO.follow).toContain('art club')
  })
})
