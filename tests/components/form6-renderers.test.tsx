import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProfileListenAnswerRenderer } from '../../src/task-engine/renderers/ProfileListenAnswerRenderer'
import { InterviewFillProfileRenderer } from '../../src/task-engine/renderers/InterviewFillProfileRenderer'
import type { Form61ProfileConfig, Form62InterviewConfig } from '../../src/task-engine/dynamic-schema'

describe('Form 6 Renderers', () => {
  describe('ProfileListenAnswerRenderer (Form 6.1)', () => {
    const sample61Config: Form61ProfileConfig = {
      intro: "Look at your new classmate's profile. Listen to the AI Coach and answer.",
      profile_title: "New Classmate's Profile",
      is_fixed_first_field: true,
      items: [
        {
          id: 'name',
          label: 'Name',
          profile_value: 'Nam',
          audio_url: '',
          accepted_answers: ['Nam', 'His name is Nam'],
          hints: ['Look at the Name row.'],
        },
        {
          id: 'class',
          label: 'Class',
          profile_value: '6A',
          audio_url: '',
          accepted_answers: ['6A', 'Class 6A'],
          hints: ['Look at the Class row.'],
        },
        {
          id: 'subject',
          label: 'Favourite subject',
          profile_value: 'English',
          audio_url: '',
          accepted_answers: ['English'],
          hints: ['Look at Favourite subject.'],
        },
        {
          id: 'activity',
          label: 'Activity after',
          profile_value: 'play football',
          audio_url: '',
          accepted_answers: ['play football'],
          hints: ['Look at Activity after.'],
        },
      ],
    }

    it('renders conversation interface with clean card layout and initiates with first question (Name)', () => {
      render(
        <ProfileListenAnswerRenderer
          config={sample61Config}
          taskCode="60145"
        />
      )

      // Đã bỏ tiêu đề "Conversation with AI Coach" và "Nhìn vào hồ sơ trong phiếu bài tập để trả lời"
      expect(screen.queryByText(/Conversation with AI Coach/i)).toBeNull()
      expect(screen.queryByText(/Nhìn vào hồ sơ trong phiếu bài tập để trả lời/i)).toBeNull()

      // Header câu hỏi hiển thị "AI Coach" thay vì "AI Coach hỏi (name)"
      expect(screen.getByText('🎙️ AI Coach')).toBeDefined()
      expect(screen.queryByText(/AI Coach hỏi/i)).toBeNull()

      expect(screen.getByPlaceholderText(/Gõ câu trả lời của bạn vào đây/i)).toBeDefined()
      expect(document.getElementById('profileSubmitBtn')).toBeDefined()
    })

    it('validates answer and shows "Try again" when wrong, progresses when correct', () => {
      const onComplete = vi.fn()
      render(
        <ProfileListenAnswerRenderer
          config={sample61Config}
          taskCode="60145"
          onComplete={onComplete}
        />
      )

      const input = screen.getByPlaceholderText(/Gõ câu trả lời của bạn vào đây/i)
      const submitBtn = document.getElementById('profileSubmitBtn')!

      // Nhập sai -> Hiển thị "Try again"
      fireEvent.change(input, { target: { value: 'Wrong Answer' } })
      fireEvent.click(submitBtn)
      expect(screen.getByText(/Try again/i)).toBeDefined()

      // Nhập đúng
      fireEvent.change(input, { target: { value: 'Nam' } })
      fireEvent.click(submitBtn)

      // Đã hoàn thành câu 1 với tick xanh ✓
      expect(screen.getByText('✓')).toBeDefined()
      expect(screen.getByText(/Nam/)).toBeDefined()
    })
  })

  describe('InterviewFillProfileRenderer (Form 6.2)', () => {
    const sample62Config: Form62InterviewConfig = {
      intro: 'Ask AI Tutor, fill in the profile, and hit Submit!',
      pass_score: 80,
      items: [
        {
          id: 'name',
          label: 'Name',
          target_answer: 'Nam',
          accepted_values: ['Nam', 'his name is Nam'],
          answer_audio_url: '',
          question_bank: ["What is his name?", "What's his name?"],
        },
        {
          id: 'class',
          label: 'Class',
          target_answer: '6A',
          accepted_values: ['6A', 'class 6A'],
          answer_audio_url: '',
          question_bank: ["Which class is he in?"],
        },
        {
          id: 'subject',
          label: 'Favourite subject',
          target_answer: 'English',
          accepted_values: ['English'],
          answer_audio_url: '',
          question_bank: ["What is his favourite subject?"],
        },
        {
          id: 'activity',
          label: 'Activity after',
          target_answer: 'play football',
          accepted_values: ['play football'],
          answer_audio_url: '',
          question_bank: ["What does he do after school?"],
        },
      ],
    }

    it('renders numbered step indicators (1, 2, 3, 4), mic button, and Audio 1 button without redundant headers', () => {
      const configWithAudio: Form62InterviewConfig = {
        ...sample62Config,
        audio_url: 'https://example.com/overall.mp3',
      }
      render(
        <InterviewFillProfileRenderer
          config={configWithAudio}
          taskCode="60146"
        />
      )

      // Đã bỏ card "Phỏng vấn AI Tutor ..."
      expect(screen.queryByText(/Phỏng vấn AI Tutor/i)).toBeNull()

      // Các thẻ bước hiển thị 1, 2, 3, 4 thay vì Name, Class
      expect(document.getElementById('step-indicator-name')?.textContent?.trim()).toBe('1')
      expect(document.getElementById('step-indicator-class')?.textContent?.trim()).toBe('2')
      expect(document.getElementById('step-indicator-subject')?.textContent?.trim()).toBe('3')
      expect(document.getElementById('step-indicator-activity')?.textContent?.trim()).toBe('4')

      // Nút Audio 1 vẫn hiển thị đầy đủ
      expect(document.getElementById('playAudio1Btn-name')).toBeDefined()

      // Hướng dẫn và nút mic đổi thành "Bấm để hỏi"
      expect(screen.getByText('Bấm để hỏi')).toBeDefined()
      expect(document.getElementById('interviewMicBtn')?.textContent).toContain('Bấm để hỏi')
    })

    it('does not display redundant AI lead text, hides hints initially', () => {
      render(
        <InterviewFillProfileRenderer
          config={sample62Config}
          taskCode="60146"
        />
      )

      // Đã bỏ tiêu đề và text "Gia sư AI dẫn dắt"
      expect(screen.queryByText(/Gia sư AI dẫn dắt/i)).toBeNull()

      // Ban đầu khi chưa làm sai: TUYỆT ĐỐI KHÔNG HIỂN THỊ GỢI Ý
      expect(screen.queryByText(/Gợi ý câu hỏi:/i)).toBeNull()
      expect(screen.queryByText(/What is his name/i)).toBeNull()
    })
  })
})
