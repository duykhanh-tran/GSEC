import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SentenceWritingRenderer } from '../../src/task-engine/renderers/SentenceWritingRenderer'
import type { Form3WritingConfig } from '../../src/task-engine/dynamic-schema'

describe('Form 3 Writing & Guided Repair Flow', () => {
  const mockConfig: Form3WritingConfig = {
    intro: 'Your answers',
    sub_mode: 'FREE_SENTENCE',
    items: [
      { id: 1, label: 'Question 1', prompt: 'Write sentence 1' },
      { id: 2, label: 'Question 2', prompt: 'Write sentence 2' },
    ],
  }

  it('renders inputs in entry phase and allows typing', async () => {
    const onAnswerChange = vi.fn()
    const onSubmit = vi.fn()

    render(
      <SentenceWritingRenderer
        config={mockConfig}
        answers={{ '1': 'Hello world', '2': '' }}
        onAnswerChange={onAnswerChange}
        onSubmit={onSubmit}
        phase="entry"
      />
    )

    const input1 = screen.getByDisplayValue('Hello world')
    expect(input1).toBeEnabled()

    const submitBtn = screen.getByRole('button', { name: /check my writing/i })
    expect(submitBtn).toBeEnabled()
    await userEvent.click(submitBtn)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('locks inputs and displays status tags in guided phase without inline hints', () => {
    render(
      <SentenceWritingRenderer
        config={mockConfig}
        answers={{ '1': 'She go to school', '2': 'They play football' }}
        onAnswerChange={vi.fn()}
        results={{
          '1': { correct: false, feedback_vi: 'Chia động từ goes', hint: 'S + V(s/es)' },
          '2': { correct: true },
        }}
        phase="guided"
        activeRetryId="1"
      />
    )

    // Inputs must be disabled during guided repair
    const inputs = screen.getAllByRole('textbox')
    expect(inputs[0]).toBeDisabled()
    expect(inputs[1]).toBeDisabled()

    // Question 1 is currently active below
    expect(screen.getByText('Đang sửa bên dưới ⬇️')).toBeInTheDocument()
    // Question 2 is already correct
    expect(screen.getByText('Correct ✓')).toBeInTheDocument()

    // Inline hint box should NOT be inside the upper card in guided phase
    expect(screen.queryByText('Chia động từ goes')).not.toBeInTheDocument()

    // Bottom cue message tells student to scroll down
    expect(
      screen.getByText(/Khung đáp án ban đầu của bạn đang được giữ nguyên để đối chiếu/i)
    ).toBeInTheDocument()
  })

  it('displays all correct tags when task reaches complete phase', () => {
    render(
      <SentenceWritingRenderer
        config={mockConfig}
        answers={{ '1': 'She goes to school', '2': 'They play football' }}
        onAnswerChange={vi.fn()}
        results={{
          '1': { correct: true },
          '2': { correct: true },
        }}
        isCompleted={true}
        phase="complete"
      />
    )

    const tags = screen.getAllByText('Correct ✓')
    expect(tags).toHaveLength(2)
    expect(
      screen.getByText(/Tất cả các câu đã hoàn thành chính xác/i)
    ).toBeInTheDocument()
  })

  it('renders paragraph mode with word counter and criteria', () => {
    const paragraphConfig: Form3WritingConfig = {
      intro: 'Paragraph writing',
      sub_mode: 'PARAGRAPH',
      paragraph: {
        prompt: 'Describe your daily routine',
        min_words: 10,
        max_words: 30,
        helper_words: ['morning', 'breakfast'],
        criteria: ['Use present simple tense'],
      },
    }

    render(
      <SentenceWritingRenderer
        config={paragraphConfig}
        answers={{ paragraph: 'In the morning I eat breakfast and walk.' }}
        onAnswerChange={vi.fn()}
      />
    )

    expect(screen.getByText(/Độ dài yêu cầu: 10 - 30 từ/i)).toBeInTheDocument()
    expect(screen.getByText('morning')).toBeInTheDocument()
    expect(screen.getByText('breakfast')).toBeInTheDocument()
    expect(screen.getByText('Use present simple tense')).toBeInTheDocument()
  })
})
