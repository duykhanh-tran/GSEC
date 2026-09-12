import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { DynamicTaskRunner } from '../../src/task-engine/DynamicTaskRunner'
import type { TaskDefinition } from '../../src/app/task-types'
import type { DynamicTaskRecord } from '../../src/task-engine/dynamic-schema'

vi.mock('../../src/lib/taskAttemptService', () => ({
  saveTaskAttempt: vi.fn(),
}))

vi.mock('../../src/hooks/useCelebrationSound', () => ({
  useCelebrationSound: vi.fn(),
}))

const mockTask60121Def: TaskDefinition = {
  code: '60121',
  unit: 1,
  lesson: 2,
  worksheet: 2,
  taskNumber: 1,
  title: 'AI Tutor • WS 2 - Task 1',
  subtitle: 'Unit 1',
  status: 'migrated',
  archetypes: ['standardized'],
}

const mockTask60121Data: DynamicTaskRecord = {
  code: '60121',
  worksheet: 2,
  task_number: 1,
  title: 'AI Tutor • WS 2 - Task 1',
  form_type: 'FORM_2_FILL',
  content: {
    unit: 1,
    lesson: 2,
    intro: 'Check Task 1. Enter your answers from the worksheet.',
    items: [
      { id: 1, label: '1', hints: ['Which verb goes with English and science?'], placeholder: 'Your answer' },
      { id: 2, label: '2', hints: ['Which verb goes with lessons?'], placeholder: 'Your answer' },
      { id: 3, label: '3', hints: ['Which verb goes with football?'], placeholder: 'Your answer' },
      { id: 4, label: '4', hints: ['Which verb goes with history?'], placeholder: 'Your answer' },
      { id: 5, label: '5', hints: ['Which verb goes with homework?'], placeholder: 'Your answer' },
      { id: 6, label: '6', hints: ['Which verb goes with music?'], placeholder: 'Your answer' },
      { id: 7, label: '7', hints: ['Which verb goes with new friends?'], placeholder: 'Your answer' },
      { id: 8, label: '8', hints: ['Which verb goes with judo?'], placeholder: 'Your answer' },
    ],
  },
}

describe('Form 2 Fill rendering and letter/word answer support', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all 8 input boxes and item count even when DB only has content.items', async () => {
    render(
      <MemoryRouter>
        <DynamicTaskRunner task={mockTask60121Def} initialData={mockTask60121Data} />
      </MemoryRouter>
    )

    expect(screen.getByText('Your answers')).toBeInTheDocument()
    expect(screen.getByText('8 items')).toBeInTheDocument()

    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(8)
  })

  it('accepts answers as single letters (a, b, c, d) and grades correctly', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <DynamicTaskRunner task={mockTask60121Def} initialData={mockTask60121Data} />
      </MemoryRouter>
    )

    const inputs = screen.getAllByRole('textbox')
    const letterAnswers = ['a', 'b', 'c', 'd', 'b', 'c', 'd', 'a']
    for (let i = 0; i < 8; i++) {
      await user.type(inputs[i], letterAnswers[i])
    }

    const checkBtn = document.getElementById('initialCheckBtn')!
    await user.click(checkBtn)

    await waitFor(() => {
      expect(screen.getAllByText(/Task complete/i).length).toBeGreaterThan(0)
    }, { timeout: 3000 })
  })

  it('accepts answers as full words case-insensitively and grades correctly', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <DynamicTaskRunner task={mockTask60121Def} initialData={mockTask60121Data} />
      </MemoryRouter>
    )

    const inputs = screen.getAllByRole('textbox')
    const wordAnswers = ['Study', 'HAVE', 'play', 'study', 'do', 'PLAY', 'have', 'do']
    for (let i = 0; i < 8; i++) {
      await user.type(inputs[i], wordAnswers[i])
    }

    const checkBtn = document.getElementById('initialCheckBtn')!
    await user.click(checkBtn)

    await waitFor(() => {
      expect(screen.getAllByText(/Task complete/i).length).toBeGreaterThan(0)
    }, { timeout: 3000 })
  })

  it('triggers guided retry when some answers are wrong and accepts retry letter', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <DynamicTaskRunner task={mockTask60121Def} initialData={mockTask60121Data} />
      </MemoryRouter>
    )

    const inputs = screen.getAllByRole('textbox')
    await user.type(inputs[0], 'wrong_answer')
    await user.type(inputs[1], 'have')
    await user.type(inputs[2], 'play')
    await user.type(inputs[3], 'study')
    await user.type(inputs[4], 'do')
    await user.type(inputs[5], 'play')
    await user.type(inputs[6], 'have')
    await user.type(inputs[7], 'do')

    const checkBtn = document.getElementById('initialCheckBtn')!
    await user.click(checkBtn)

    await waitFor(() => {
      expect(screen.getByText(/need another look/i)).toBeInTheDocument()
    })

    const retryInput = await screen.findByPlaceholderText(/Type your answer/i)
    await user.type(retryInput, 'a')

    const retrySection = retryInput.closest('section')!
    const retryCheckBtn = retrySection.querySelector('button')!
    await user.click(retryCheckBtn)

    await waitFor(() => {
      expect(screen.getAllByText(/Correct ✓/i).length).toBeGreaterThan(0)
    })
  })
})
