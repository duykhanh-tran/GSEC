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

    // Question 1 has no yellow warning tag
    expect(screen.queryByText('Đang sửa bên dưới ⬇️')).not.toBeInTheDocument()
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

    expect(screen.getByText(/Min: 10 \| Max: 30/i)).toBeInTheDocument()
    expect(screen.getByText('morning')).toBeInTheDocument()
    expect(screen.getByText('breakfast')).toBeInTheDocument()
    expect(screen.getByText('Use present simple tense')).toBeInTheDocument()
  })

  it('renders sentence starter and ending in SentenceWritingRenderer', () => {
    const starterConfig: Form3WritingConfig = {
      intro: 'Sentence starters test',
      sub_mode: 'FREE_SENTENCE',
      items: [
        {
          id: 1,
          label: 'Question 1',
          sentence_starter: 'My school is',
          sentence_ending: 'every day.',
        },
        {
          id: 2,
          label: 'Question 2',
          sentence_starter: 'In my bag, I have',
        },
      ],
    }

    render(
      <SentenceWritingRenderer
        config={starterConfig}
        answers={{ '1': 'very big and clean', '2': '' }}
        onAnswerChange={vi.fn()}
      />
    )

    expect(screen.getByText('My school is')).toBeInTheDocument()
    expect(screen.getByText('every day.')).toBeInTheDocument()
    expect(screen.getByText('In my bag, I have')).toBeInTheDocument()

    const input1 = screen.getByDisplayValue('very big and clean')
    expect(input1).toHaveAttribute('placeholder', 'viết tiếp câu của bạn...')
  })

  it('buildFullSentence correctly combines prefix, student input, and suffix without duplication', async () => {
    const { buildFullSentence } = await import('../../src/task-engine/DynamicTaskRunner')

    // Case 1: normal continuation
    expect(buildFullSentence('very beautiful', 'My school is')).toBe('My school is very beautiful')

    // Case 2: student re-typed the starter accidentally
    expect(buildFullSentence('My school is very beautiful', 'My school is')).toBe('My school is very beautiful')
    expect(buildFullSentence('my school is very beautiful', 'My school is')).toBe('my school is very beautiful')

    // Case 3: starter and ending combined
    expect(buildFullSentence('very clean', 'My classroom is', 'every morning.')).toBe(
      'My classroom is very clean every morning.'
    )

    // Case 4: ending already typed
    expect(buildFullSentence('very clean every morning.', 'My classroom is', 'every morning.')).toBe(
      'My classroom is very clean every morning.'
    )

    // Case 5: no starter or ending
    expect(buildFullSentence('I love studying English.')).toBe('I love studying English.')

    // Case 6: time expression with preposition starter deduplication
    expect(buildFullSentence('at 5.30pm', 'I have breakfast at')).toBe('I have breakfast at 5.30pm')
    expect(buildFullSentence('5.30pm', 'I have breakfast at')).toBe('I have breakfast at 5.30pm')
  })

  it('accepts time inputs without false gibberish or lexicon errors', async () => {
    const { checkSentenceLexicon, isKnownWord } = await import('../../src/lib/englishLexicon')
    const { detectGibberish } = await import('../../src/lib/aiGradingService')

    // Time tokens with digits should be recognized as known words
    expect(isKnownWord('5.30')).toBe(true)
    expect(isKnownWord('5:30')).toBe(true)
    expect(isKnownWord('5.30pm')).toBe(true)
    expect(isKnownWord('pm')).toBe(true)
    expect(isKnownWord('oclock')).toBe(true)

    // Lexicon check should accept time sentences without errors
    const lexCheck1 = checkSentenceLexicon('I have breakfast at 5.30pm.')
    expect(lexCheck1.hasError).toBe(false)

    const lexCheck2 = checkSentenceLexicon('I leave home at 6:45 a.m.')
    expect(lexCheck2.hasError).toBe(false)

    // Detect gibberish should not flag time expressions
    expect(detectGibberish('5.30').isGibberish).toBe(false)
    expect(detectGibberish('5:30pm').isGibberish).toBe(false)
    expect(detectGibberish('I have breakfast at 5.30pm.').isGibberish).toBe(false)
  })
})


