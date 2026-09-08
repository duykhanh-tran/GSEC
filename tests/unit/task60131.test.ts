import { describe, expect, it } from 'vitest'

import { DEMO_ANSWERS, itemIsCorrect, normalizeAnswer } from '../../src/tasks/60131/data'

describe('Task 60131 grammar contract', () => {
  it('normalizes case, spaces and curly apostrophes', () => {
    expect(normalizeAnswer('  DOESN’T   PLAY ')).toBe("doesn't play")
  })

  it('keeps the two intended demo errors', () => {
    expect([2, 8].filter((id) => !itemIsCorrect(DEMO_ANSWERS, id))).toEqual([2, 8])
    expect(itemIsCorrect(DEMO_ANSWERS, 1)).toBe(true)
  })
})
