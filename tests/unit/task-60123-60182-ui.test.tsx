import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DynamicTaskRunner } from '../../src/task-engine/DynamicTaskRunner'
import { TaskAudioPlayer } from '../../src/components/listening/TaskAudioPlayer'
import { getFormPedagogicalLeadIn } from '../../src/lib/aiGradingService'
import type { TaskDefinition } from '../../src/app/task-types'
import type { DynamicTaskRecord } from '../../src/task-engine/dynamic-schema'

vi.mock('../../src/lib/taskAttemptService', () => ({
  saveTaskAttempt: vi.fn(),
}))

vi.mock('../../src/hooks/useCelebrationSound', () => ({
  useCelebrationSound: vi.fn(),
}))

describe('Task 60123 & 60182 UI specifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generates Check Task lead-in instead of Chào em for 60123 and 60182', () => {
    // 60182: Check Task 2. Listen and read the text. Choose the correct answer A, B, or C.
    const leadIn60182 = getFormPedagogicalLeadIn(
      'FORM_1_CHOICE',
      { intro: 'Check Task 2. Listen and read the text. Choose the correct answer A, B, or C.' },
      'AI Tutor • WS 8 - Task 2'
    )
    expect(leadIn60182).toContain('Check Task 2. Listen and read the text')
    expect(leadIn60182).not.toContain('Chào em')

    // 60123: Check Task 3 . Listen and tick the sound you hear
    const leadIn60123 = getFormPedagogicalLeadIn(
      'FORM_1_CHOICE',
      { intro: 'Check Task 3 . Listen and tick the sound you hear' },
      'AI Tutor • WS 2 - Task 3'
    )
    expect(leadIn60123).toContain('Check Task 3. Listen and tick the sound you hear')
    expect(leadIn60123).not.toContain('Chào em')

    // When content has no intro, it still produces Check Task N format
    const defaultLeadIn = getFormPedagogicalLeadIn('FORM_1_CHOICE', {}, 'AI Tutor • WS 8 - Task 2')
    expect(defaultLeadIn).toContain('Check Task 2')
    expect(defaultLeadIn).not.toContain('Chào em')
  })

  it('TaskAudioPlayer removes "Listen to the audio once to start the task" and shows "Listen 1 time to start answering"', () => {
    render(
      <TaskAudioPlayer
        src="https://example.com/audio.mp3"
        title="AI Tutor • WS 8 - Task 2 • Listening"
        requiredListens={1}
        listenCount={0}
        onListenComplete={vi.fn()}
      />
    )

    // Check that "Listen to the audio once to start the task" is REMOVED
    expect(screen.queryByText(/Listen to the audio once to start the task/i)).toBeNull()

    // Check that locked notice shows "Listen 1 time to start answering"
    expect(screen.getByText(/Listen 1 time to start answering/i)).toBeDefined()
    expect(screen.queryByText(/Task questions are currently locked/i)).toBeNull()
  })

  it('DynamicTaskRunner removes "Use the worksheet questions while entering your choices." card', () => {
    const mockTask60182: TaskDefinition = {
      code: '60182',
      unit: 1,
      lesson: 8,
      worksheet: 8,
      taskNumber: 2,
      title: 'AI Tutor • WS 8 - Task 2',
      subtitle: 'Unit 1',
      status: 'migrated',
      archetypes: ['listening', 'choice-assessment'],
    }

    const mockDb60182: DynamicTaskRecord = {
      code: '60182',
      worksheet: 8,
      task_number: 2,
      title: 'AI Tutor • WS 8 - Task 2',
      form_type: 'FORM_1_CHOICE',
      content: {
        intro: 'Check Task 2. Listen and read the text. Choose the correct answer A, B, or C.',
        options: ['A', 'B', 'C'],
        audioUrl: 'https://example.com/audio.mp3',
        items: [
          { id: 1, label: 'Question 1', cue: 'Look at Question 1.' },
          { id: 2, label: 'Question 2', cue: 'Look at Question 2.' },
        ],
      },
    }

    render(
      <MemoryRouter>
        <DynamicTaskRunner task={mockTask60182} initialData={mockDb60182} />
      </MemoryRouter>
    )

    // Opening tutor bubble has Check Task 2
    expect(screen.getByText('Check Task 2.')).toBeDefined()
    expect(screen.queryByText(/Chào em/i)).toBeNull()

    // "Use the worksheet questions while entering your choices." is REMOVED
    expect(screen.queryByText(/Use the worksheet questions while entering your choices/i)).toBeNull()
  })
})
