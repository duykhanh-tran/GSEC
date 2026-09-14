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

    it('renders conversation interface and initiates with first question (Name)', () => {
      render(
        <ProfileListenAnswerRenderer
          config={sample61Config}
          taskCode="60145"
        />
      )

      // Kiểm tra tiêu đề và hướng dẫn kết hợp sách
      expect(screen.getByText(/Conversation with AI Coach/i)).toBeDefined()
      expect(screen.getByText(/Nhìn vào hồ sơ trong phiếu bài tập để trả lời/i)).toBeDefined()

      // Kiểm tra dòng 1 là câu hỏi đầu tiên
      expect(screen.getByText(/1\. You:/i)).toBeDefined()
      expect(screen.getByPlaceholderText(/Gõ câu trả lời của bạn vào đây/i)).toBeDefined()
    })

    it('validates answer and progresses when correct answer is submitted', () => {
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

      // Nhập sai trước
      fireEvent.change(input, { target: { value: 'Wrong Answer' } })
      fireEvent.click(submitBtn)
      expect(screen.getByText(/Look at the Name row/i)).toBeDefined()

      // Nhập đúng
      fireEvent.change(input, { target: { value: 'Nam' } })
      fireEvent.click(submitBtn)

      // Row 1 đã đúng và có dấu tick ✓
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

    it('renders sequential step indicators, mic button, and Audio 1 button without redundant audio box', () => {
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

      // Không còn hiển thị box audio tổng quan dạng thanh nghe
      expect(screen.queryByText(/Audio tổng quan bài học/i)).toBeNull()

      expect(document.getElementById('interviewMicBtn')).toBeDefined()
      expect(document.getElementById('step-indicator-name')).toBeDefined()
      expect(document.getElementById('step-indicator-class')).toBeDefined()
      expect(document.getElementById('step-indicator-subject')).toBeDefined()
      expect(document.getElementById('step-indicator-activity')).toBeDefined()
      expect(document.getElementById('playAudio1Btn-name')).toBeDefined()
    })

    it('does not display redundant headers (CÂU HỎI 1 / 4 & Hỏi về: Name), hides hints initially, and shows clean pedagogical AI lead-in', () => {
      render(
        <InterviewFillProfileRenderer
          config={sample62Config}
          taskCode="60146"
        />
      )

      // Đã bỏ hoàn toàn "CÂU HỎI 1 / 4" và "Hỏi về: Name"
      expect(screen.queryByText(/CÂU HỎI 1 \/ 4/i)).toBeNull()
      expect(screen.queryByText(/Hỏi về:/i)).toBeNull()

      // Hiển thị ô Gia sư AI dẫn dắt
      expect(screen.getByText(/Gia sư AI dẫn dắt/i)).toBeDefined()

      // Ban đầu khi chưa làm sai: TUYỆT ĐỐI KHÔNG HIỂN THỊ GỢI Ý
      expect(screen.queryByText(/Gợi ý câu hỏi:/i)).toBeNull()
      expect(screen.queryByText(/What is his name/i)).toBeNull()
    })
  })
})
