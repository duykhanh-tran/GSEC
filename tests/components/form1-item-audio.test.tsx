import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { DynamicTaskRunner } from '../../src/task-engine/DynamicTaskRunner'
import type { TaskDefinition } from '../../src/app/task-types'
import type { DynamicTaskRecord } from '../../src/task-engine/dynamic-schema'
import { supabase } from '../../src/lib/supabaseClient'

vi.mock('../../src/lib/taskAttemptService', () => ({
  saveTaskAttempt: vi.fn(),
}))

vi.mock('../../src/hooks/useCelebrationSound', () => ({
  useCelebrationSound: vi.fn(),
}))

const mockTaskDef: TaskDefinition = {
  code: '60171',
  unit: 1,
  lesson: 1,
  worksheet: 1,
  taskNumber: 1,
  title: 'Test Multiple Choice Task',
  subtitle: 'Unit 1',
  status: 'migrated',
  archetypes: ['choice-assessment'],
}

const mockForm1Data: DynamicTaskRecord = {
  code: '60171',
  worksheet: 1,
  task_number: 1,
  title: 'Test Multiple Choice Task',
  form_type: 'FORM_1_CHOICE',
  content: {
    intro: 'Choose the correct answers below.',
    options: ['A', 'B', 'C'],
    items: [
      {
        id: 1,
        label: 'Question 1',
        audio_url: 'https://cdn.example.com/audio/q1-explanation.mp3',
        cue: 'Look back at Question 1.',
        hints: ['Hint for Question 1.'],
      },
      {
        id: 2,
        label: 'Question 2',
        cue: 'Look back at Question 2.',
        hints: ['Hint for Question 2.'],
      },
    ],
  },
}

describe('Form 1 Item Audio on Guided Retry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders audio player when student answers Question 1 (with audio_url) incorrectly', async () => {
    const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
      data: {
        success: true,
        results: {
          '1': { correct: false, hint: 'Hint for Question 1.' },
          '2': { correct: true },
        },
      },
      error: null,
    } as any)

    render(
      <MemoryRouter>
        <DynamicTaskRunner task={mockTaskDef} initialData={mockForm1Data} />
      </MemoryRouter>
    )

    expect(screen.queryByText(/Nghe lại đoạn âm thanh của câu này/i)).not.toBeInTheDocument()

    const optA = screen.getByLabelText('Question 1: A')
    const optB = screen.getByLabelText('Question 2: B')
    await userEvent.click(optA)
    await userEvent.click(optB)

    const checkBtn = document.getElementById('initialCheckBtn')!
    await userEvent.click(checkBtn)

    expect(rpcSpy).toHaveBeenCalledWith('grade_student_attempt', expect.any(Object))

    await waitFor(
      () => {
        expect(screen.getByText(/Nghe lại đoạn âm thanh của câu này/i)).toBeInTheDocument()
      },
      { timeout: 2500 }
    )

    const audioEl = document.querySelector('audio')
    expect(audioEl).toBeInTheDocument()
    expect(audioEl?.src).toBe('https://cdn.example.com/audio/q1-explanation.mp3')
  })

  it('does NOT render audio player when student answers Question 2 (without audio_url) incorrectly', async () => {
    const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
      data: {
        success: true,
        results: {
          '1': { correct: true },
          '2': { correct: false, hint: 'Hint for Question 2.' },
        },
      },
      error: null,
    } as any)

    render(
      <MemoryRouter>
        <DynamicTaskRunner task={mockTaskDef} initialData={mockForm1Data} />
      </MemoryRouter>
    )

    const optA = screen.getByLabelText('Question 1: A')
    const optB = screen.getByLabelText('Question 2: B')
    await userEvent.click(optA)
    await userEvent.click(optB)

    const checkBtn = document.getElementById('initialCheckBtn')!
    await userEvent.click(checkBtn)

    expect(rpcSpy).toHaveBeenCalledWith('grade_student_attempt', expect.any(Object))

    await waitFor(
      () => {
        expect(screen.getByText(/Question 2/i)).toBeInTheDocument()
      },
      { timeout: 2500 }
    )

    expect(screen.queryByText(/Nghe lại đoạn âm thanh của câu này/i)).not.toBeInTheDocument()
    expect(document.querySelector('audio')).toBeNull()
  })
})
