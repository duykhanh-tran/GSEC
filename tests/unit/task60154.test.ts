import { describe, expect, it } from 'vitest'

import { DEMO_CHECKS, PLAN_ITEMS } from '../../src/tasks/60154/data'

describe('Task 60154 data contract', () => {
  it('has four unique speaking-plan parts and demo leaves only activity missing', () => {
    expect(PLAN_ITEMS).toHaveLength(4)
    expect(new Set(PLAN_ITEMS.map((item) => item.id)).size).toBe(4)
    expect(PLAN_ITEMS.filter((item) => !DEMO_CHECKS[item.id]).map((item) => item.id)).toEqual(['activity'])
  })
})
