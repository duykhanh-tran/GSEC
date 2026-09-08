import { describe, expect, it } from 'vitest'

import { TASK_60151_CONFIG } from '../../src/tasks/60151/data'
import { TASK_60152_CONFIG } from '../../src/tasks/60152/data'
import { TASK_60153_CONFIG } from '../../src/tasks/60153/data'

describe('WS5 guided-choice configuration', () => {
  it.each([
    [TASK_60151_CONFIG, [1, 3]],
    [TASK_60152_CONFIG, [2, 4, 5, 6]],
    [TASK_60153_CONFIG, [2, 3, 5]],
  ])('preserves intended demo errors', (config, expectedWrong) => {
    const wrong = config.items.filter((item) => config.demoAnswers[item.id] !== item.key).map((item) => item.id)
    expect(wrong).toEqual(expectedWrong)
  })
})
