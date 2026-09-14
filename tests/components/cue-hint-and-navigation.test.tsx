import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SpeakingPronunciationRenderer } from '../../src/task-engine/renderers/SpeakingPronunciationRenderer'
import { DynamicTaskRunner } from '../../src/task-engine/DynamicTaskRunner'
import { NotFoundPage } from '../../src/app/pages/NotFoundPage'
import type { TaskDefinition } from '../../src/app/task-types'
import type { DynamicTaskRecord } from '../../src/task-engine/dynamic-schema'

vi.mock('../../src/lib/taskAttemptService', () => ({
  saveTaskAttempt: vi.fn(),
}))

vi.mock('../../src/hooks/useCelebrationSound', () => ({
  useCelebrationSound: vi.fn(),
}))

vi.mock('../../src/lib/studentWritingStorageService', () => ({
  getApprovedWriting: vi.fn().mockResolvedValue(null),
}))

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({
      data: {
        success: true,
        score: 50,
        correct_count: 1,
        total_count: 2,
        results: {
          '1': { is_correct: true, submitted: 'study' },
          '2': { is_correct: false, submitted: 'play' },
        },
      },
      error: null,
    }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  },
}))

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="current-location">{location.pathname}</div>
}

describe('Navigation and Cue vs Hint Separation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('SpeakingPronunciationRenderer navigates to /tasks/:code when clicking the exercise button', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/tasks/60176']}>
        <Routes>
          <Route
            path="/tasks/60176"
            element={
              <>
                <LocationDisplay />
                <SpeakingPronunciationRenderer
                  config={{ linked_task_code: '60175', pass_score: 80 }}
                  taskCode="60176"
                />
              </>
            }
          />
          <Route path="/tasks/60175" element={<div data-testid="task-60175-target">Task 60175 Loaded</div>} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Yêu cầu hoàn thành bài viết trước/i)).toBeInTheDocument()
    })

    const toTaskBtn = screen.getByRole('button', { name: /Đến làm bài tập 60175/i })
    expect(toTaskBtn).toBeInTheDocument()

    await user.click(toTaskBtn)

    await waitFor(() => {
      expect(screen.getByTestId('task-60175-target')).toBeInTheDocument()
    })
  })

  it('NotFoundPage automatically redirects 5-digit code route to /tasks/:code', async () => {
    render(
      <MemoryRouter initialEntries={['/60175']}>
        <Routes>
          <Route path="/tasks/:code" element={<div data-testid="redirected-task-page">Redirected to Task</div>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('redirected-task-page')).toBeInTheDocument()
    })
  })

  it('DynamicTaskRunner clearly distinguishes câu dẫn (cue) and hint đáp án in retry mode', async () => {
    const user = userEvent.setup()

    const mockTaskDef: TaskDefinition = {
      code: '60121',
      unit: 1,
      lesson: 2,
      worksheet: 2,
      taskNumber: 2,
      title: 'AI Tutor • WS 2 - Task 2',
      subtitle: 'Unit 1',
      status: 'migrated',
      archetypes: ['standardized'],
    }

    const mockTaskData: DynamicTaskRecord = {
      code: '60121',
      worksheet: 2,
      task_number: 2,
      title: 'AI Tutor • WS 2 - Task 2',
      form_type: 'FORM_2_FILL',
      content: {
        intro: 'Check Task 2.',
        items: [
          {
            id: 1,
            label: '1',
            cue: 'Lan is a student at Trung Vuong Secondary School. Look back at blank (1).',
            hints: ['English and science are school subjects. Which verb goes with subjects?'],
            accepted: ['study'],
          },
          {
            id: 2,
            label: '2',
            cue: 'Lan is a student at Trung Vuong Secondary School. Look back at blank (2).',
            hints: ['Lunch is a meal, like breakfast and dinner. Which verb goes with meals?'],
            accepted: ['have'],
          },
        ],
      },
    }

    render(
      <MemoryRouter>
        <DynamicTaskRunner task={mockTaskDef} initialData={mockTaskData} />
      </MemoryRouter>
    )

    // Nhập câu 1 đúng ("study"), câu 2 sai ("play")
    const inputs = screen.getAllByRole('textbox')
    await user.type(inputs[0], 'study')
    await user.type(inputs[1], 'play')

    const checkBtn = document.getElementById('initialCheckBtn')!
    await user.click(checkBtn)

    // Chờ vào giai đoạn Guided Retry
    await waitFor(() => {
      // 1. Phải có nhãn rõ ràng cho Lời dẫn / Lời nhắc
      expect(screen.getByText(/Lời dẫn \/ Lời nhắc:/i)).toBeInTheDocument()
      // 2. Nội dung câu dẫn hiển thị chính xác dưới Question 1
      expect(screen.getAllByText(/Lan is a student at Trung Vuong Secondary School\. Look back at blank \(1\)\./i).length).toBeGreaterThanOrEqual(1)
      // 3. Phải có nhãn rõ ràng cho Gợi ý đáp án
      expect(screen.getByText(/Gợi ý đáp án:/i)).toBeInTheDocument()
      // 4. Nội dung gợi ý đáp án hiển thị riêng biệt bên dưới
      expect(screen.getByText(/English and science are school subjects\. Which verb goes with subjects\?/i)).toBeInTheDocument()
    }, { timeout: 4000 })
  })
})
