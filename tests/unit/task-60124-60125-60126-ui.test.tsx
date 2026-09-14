import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ListenRepeatRenderer } from '../../src/task-engine/renderers/ListenRepeatRenderer'
import type { Form5ListenRepeatConfig } from '../../src/task-engine/dynamic-schema'

describe('Tasks 60124, 60125, 60126 UI specifications (ListenRepeatRenderer)', () => {
  const mockConfig: Form5ListenRepeatConfig = {
    intro: 'Listen and repeat each word',
    pass_score: 60,
    items: [
      {
        id: 'item-1',
        label: 'Sentence 1',
        target_text: 'art',
        audio_url: 'https://example.com/art.mp3',
        hints: ['Focus on /ɑː/'],
      },
      {
        id: 'item-2',
        label: 'Sentence 2',
        target_text: 'class',
        audio_url: 'https://example.com/class.mp3',
      },
      {
        id: 'item-3',
        label: 'Sentence 3',
        target_text: 'start',
      },
      {
        id: 'item-4',
        label: 'Sentence 4',
        target_text: 'smart',
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders "Điểm yêu cầu: 60%" and removes "Nghe từng câu mẫu cẩn thận..."', () => {
    const { container } = render(
      <ListenRepeatRenderer
        config={mockConfig}
        onComplete={vi.fn()}
      />
    )

    // Check "Điểm yêu cầu: 60%" is present in lr-pass-badge
    const badge = container.querySelector('.lr-pass-badge')
    expect(badge?.textContent).toContain('Điểm yêu cầu:')
    expect(badge?.textContent).toContain('60%')
    expect(screen.queryByText(/Tiêu chuẩn qua câu/i)).toBeNull()

    // Check "Nghe từng câu mẫu cẩn thận..." is removed
    expect(screen.queryByText(/Nghe từng câu mẫu cẩn thận/i)).toBeNull()
  })

  it('renders step pills as 1, 2, 3, 4 instead of Sentence 1, Sentence 2, ...', () => {
    const { container } = render(
      <ListenRepeatRenderer
        config={mockConfig}
        onComplete={vi.fn()}
      />
    )

    // Check step pills have 1, 2, 3, 4
    const pills = Array.from(container.querySelectorAll('.lr-step-pill'))
    expect(pills.length).toBe(4)
    expect(pills[0].textContent?.trim()).toBe('1')
    expect(pills[1].textContent?.replace(/[^0-9]/g, '')).toBe('2')
    expect(pills[2].textContent?.replace(/[^0-9]/g, '')).toBe('3')
    expect(pills[3].textContent?.replace(/[^0-9]/g, '')).toBe('4')

    // Ensure "Sentence 1", "Sentence 2" do not appear as pill labels
    expect(screen.queryByText('Sentence 1')).toBeNull()
    expect(screen.queryByText('Sentence 2')).toBeNull()
  })

  it('removes target sentence box ("Sentence 1 • Nghe audio mẫu và thu âm...")', () => {
    render(
      <ListenRepeatRenderer
        config={mockConfig}
        onComplete={vi.fn()}
      />
    )

    expect(screen.queryByText(/Nghe audio mẫu và thu âm lặp lại/i)).toBeNull()
    expect(screen.queryByText(/Gợi ý phát âm/i)).toBeNull()
  })

  it('displays "Ấn để thu âm." instead of "Nhấn biểu tượng Microphone..."', () => {
    render(
      <ListenRepeatRenderer
        config={mockConfig}
        onComplete={vi.fn()}
      />
    )

    expect(screen.getByText('Ấn để thu âm.')).toBeDefined()
    expect(screen.queryByText(/Nhấn biểu tượng Microphone để đọc lại câu vừa nghe/i)).toBeNull()
  })
})
