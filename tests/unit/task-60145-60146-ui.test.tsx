import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProfileListenAnswerRenderer } from '../../src/task-engine/renderers/ProfileListenAnswerRenderer'
import { InterviewFillProfileRenderer } from '../../src/task-engine/renderers/InterviewFillProfileRenderer'
import type { Form61ProfileConfig, Form62InterviewConfig } from '../../src/task-engine/dynamic-schema'

describe('Tasks 60145 & 60146 UI Requirements', () => {
  describe('Task 60145 (ProfileListenAnswerRenderer)', () => {
    const mockConfig61: Form61ProfileConfig = {
      intro: "Look at your new classmate's profile. Listen to the AI Coach and answer.",
      profile_title: "New Classmate's Profile",
      items: [
        {
          id: 'name',
          label: 'Name',
          profile_value: 'Nam',
          audio_url: '',
          accepted_answers: ['Nam', 'His name is Nam'],
        },
        {
          id: 'class',
          label: 'Class',
          profile_value: '6A',
          audio_url: '',
          accepted_answers: ['6A', 'Class 6A'],
        },
      ],
    }

    it('removes conversation header banner and displays "AI Coach" without (name)', () => {
      render(<ProfileListenAnswerRenderer config={mockConfig61} taskCode="60145" />)

      // Bỏ header: “Conversation with AI Coach, Nhìn vào hồ sơ trong phiếu bài tập để trả lời”
      expect(screen.queryByText(/Conversation with AI Coach/i)).toBeNull()
      expect(screen.queryByText(/Nhìn vào hồ sơ trong phiếu bài tập để trả lời/i)).toBeNull()

      // Đổi “AI Coach hỏi (name)” -> “AI Coach”
      expect(screen.getByText('🎙️ AI Coach')).toBeDefined()
      expect(screen.queryByText(/AI Coach hỏi/i)).toBeNull()
      expect(screen.queryByText(/AI Coach hỏi \(Name\)/i)).toBeNull()

      // Nút Check nằm trong card
      expect(document.getElementById('profileSubmitBtn')).toBeDefined()
    })

    it('shows "Try again" on incorrect input and renders Congratulation on completion', () => {
      render(<ProfileListenAnswerRenderer config={mockConfig61} taskCode="60145" />)

      const input = screen.getByPlaceholderText(/Gõ câu trả lời của bạn vào đây/i)
      const submitBtn = document.getElementById('profileSubmitBtn')!

      // Nhập sai -> "Try again"
      fireEvent.change(input, { target: { value: 'Wrong Answer' } })
      fireEvent.click(submitBtn)
      expect(screen.getByText(/Try again/i)).toBeDefined()

      // Hoàn thành câu 1 (Nam)
      fireEvent.change(input, { target: { value: 'Nam' } })
      fireEvent.click(submitBtn)

      // Hoàn thành câu 2 (6A)
      const input2 = screen.getByPlaceholderText(/Gõ câu trả lời của bạn vào đây/i)
      fireEvent.change(input2, { target: { value: '6A' } })
      fireEvent.click(document.getElementById('profileSubmitBtn')!)

      // Màn hình hoàn thành hiển thị "Congratulation"
      expect(screen.getByText('Congratulation')).toBeDefined()
      expect(screen.queryByText(/Task Complete • Hoàn thành xuất sắc/i)).toBeNull()
      expect(screen.getByText('100')).toBeDefined()
    })
  })

  describe('Task 60146 (InterviewFillProfileRenderer)', () => {
    const mockConfig62: Form62InterviewConfig = {
      intro: 'Phỏng vấn AI Tutor',
      items: [
        {
          id: 'name',
          label: 'Name',
          target_answer: 'Nam',
          accepted_values: ['Nam'],
          answer_audio_url: '',
          question_bank: ["What is his name?"],
        },
        {
          id: 'class',
          label: 'Class',
          target_answer: '6A',
          accepted_values: ['6A'],
          answer_audio_url: '',
          question_bank: ["Which class is he in?"],
        },
      ],
    }

    it('removes "Phỏng vấn AI Tutor" card, renames step pills to 1, 2, and keeps only Audio 1 button', () => {
      render(<InterviewFillProfileRenderer config={mockConfig62} taskCode="60146" />)

      // Bỏ card “Phỏng vấn AI Tutor …”
      expect(screen.queryByText(/Phỏng vấn AI Tutor: Lắng nghe lời dẫn/i)).toBeNull()

      // Đổi tên các thẻ thành 1, 2
      expect(document.getElementById('step-indicator-name')?.textContent?.trim()).toBe('1')
      expect(document.getElementById('step-indicator-class')?.textContent?.trim()).toBe('2')

      // Thẻ Gia sư dẫn dắt: bỏ hết tiêu đề và text
      expect(screen.queryByText(/Gia sư AI dẫn dắt/i)).toBeNull()

      // Chỉ để lại nút nghe Audio 1
      expect(document.getElementById('playAudio1Btn-name')).toBeDefined()

      // Đổi thành "Bấm để hỏi"
      expect(screen.getByText('Bấm để hỏi')).toBeDefined()
      expect(document.getElementById('interviewMicBtn')?.textContent).toContain('Bấm để hỏi')
    })
  })
})
