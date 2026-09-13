import { describe, expect, it } from 'vitest'
import {
  normalizeFillAnswer,
  areFillAnswersMatching,
  gradeAnswersLocally,
} from '../../src/task-engine/DynamicTaskRunner'
import type { DynamicTaskRecord } from '../../src/task-engine/dynamic-schema'

describe('Form 2 Fill - Advanced Answer Normalization & Matching Engine', () => {
  describe('normalizeFillAnswer', () => {
    it('normalizes spaces, punctuation spacing, smart quotes, and dashes', () => {
      expect(normalizeFillAnswer("  Linh  doesn’t  go   to school . ")).toBe("linh doesn't go to school.")
      expect(normalizeFillAnswer('“Hello  world”')).toBe('"hello world"')
      expect(normalizeFillAnswer('b—c–d-a')).toBe('b-c-d-a')
    })

    it('handles empty or null values gracefully', () => {
      expect(normalizeFillAnswer('')).toBe('')
      expect(normalizeFillAnswer(null as any)).toBe('')
      expect(normalizeFillAnswer(undefined as any)).toBe('')
    })
  })

  describe('areFillAnswersMatching', () => {
    it('matches exact and case-insensitive strings', () => {
      expect(areFillAnswersMatching('study', 'Study')).toBe(true)
      expect(areFillAnswersMatching('PLAY', 'play')).toBe(true)
      expect(areFillAnswersMatching('  have  ', 'have')).toBe(true)
    })

    it('matches sentences regardless of trailing punctuation (. ? ! , ;)', () => {
      expect(areFillAnswersMatching('Our lessons start at 7.15', 'Our lessons start at 7.15.')).toBe(true)
      expect(areFillAnswersMatching('Does Tom join the art club on Friday', 'Does Tom join the art club on Friday?')).toBe(true)
      expect(areFillAnswersMatching('We do not have classes on Sunday!', 'We do not have classes on Sunday.')).toBe(true)
    })

    it('matches smart quotes and contractions', () => {
      expect(areFillAnswersMatching('Linh doesn’t go to school by bus', "Linh doesn't go to school by bus.")).toBe(true)
      expect(areFillAnswersMatching("Linh doesnt go to school by bus", "Linh doesn't go to school by bus.")).toBe(true)
      expect(areFillAnswersMatching("Linh does not go to school by bus", "Linh doesn't go to school by bus.")).toBe(true)
      expect(areFillAnswersMatching("don't study", "do not study")).toBe(true)
      expect(areFillAnswersMatching("dont study", "don't study")).toBe(true)
    })

    it('matches time representations (7.15 vs 7:15 vs 7h15)', () => {
      expect(areFillAnswersMatching('Our lessons start at 7:15', 'Our lessons start at 7.15.')).toBe(true)
      expect(areFillAnswersMatching('The first lesson finishes at 8:15', 'The first lesson finishes at 8.15.')).toBe(true)
      expect(areFillAnswersMatching('Our lessons start at 7h15', 'Our lessons start at 7.15.')).toBe(true)
    })

    it('matches sequence letters (Task 60144)', () => {
      expect(areFillAnswersMatching('b, c, d, a', 'b-c-d-a')).toBe(true)
      expect(areFillAnswersMatching('b c d a', 'b-c-d-a')).toBe(true)
      expect(areFillAnswersMatching('bcda', 'b-c-d-a')).toBe(true)
      expect(areFillAnswersMatching('b,d,a,c', 'b-d-a-c')).toBe(true)
    })
  })

  describe('gradeAnswersLocally for Form 2 tasks', () => {
    it('successfully grades Task 60131 with labels 7a, 7b, 8a, 8b even when DB content has undefined accepted', () => {
      const task60131: DynamicTaskRecord = {
        code: '60131',
        worksheet: 3,
        task_number: 1,
        title: 'AI Tutor • WS 3 - Task 1',
        form_type: 'FORM_2_FILL',
        content: {
          items: [
            { id: 1, label: '1' },
            { id: 2, label: '2' },
            { id: 3, label: '3' },
            { id: 4, label: '4' },
            { id: 5, label: '5' },
            { id: 6, label: '6' },
            { id: 7, label: '7a' },
            { id: 8, label: '7b' },
            { id: 9, label: '8a' },
            { id: 10, label: '8b' },
          ],
        },
      }

      const answers = {
        '1': 'live',
        '2': 'goes',
        '3': 'have',
        '4': 'starts',
        '5': "don't study",
        '6': "doesn't play",
        '7': 'do',
        '8': 'wear',
        '9': 'does',
        '10': 'like',
      }

      const res = gradeAnswersLocally(task60131, answers, 1)
      expect(res.score).toBe(100)
      expect(res.correct_count).toBe(10)
      expect(res.is_completed).toBe(true)
    })

    it('successfully grades Task 60133 with adverb of frequency sentence reordering', () => {
      const task60133: DynamicTaskRecord = {
        code: '60133',
        worksheet: 3,
        task_number: 3,
        title: 'AI Tutor • WS 3 - Task 3',
        form_type: 'FORM_2_FILL',
        content: {
          items: [
            { id: 1, label: '1' },
            { id: 2, label: '2' },
            { id: 3, label: '3' },
            { id: 4, label: '4' },
          ],
        },
      }

      // Học sinh có thể điền cụm từ hoặc cả câu (có/không có dấu chấm)
      const answers = {
        '1': 'I usually do my homework after dinner',
        '2': 'lan often uses the computer room at break time.',
        '3': 'usually have',
        '4': 'does minh sometimes have lunch at school',
      }

      const res = gradeAnswersLocally(task60133, answers, 1)
      expect(res.score).toBe(100)
      expect(res.correct_count).toBe(4)
      expect(res.is_completed).toBe(true)
    })

    it('grades custom task with multi-delimiter accepted answers correctly', () => {
      const customTask: DynamicTaskRecord = {
        code: '99999',
        worksheet: 1,
        task_number: 1,
        title: 'Custom Task',
        form_type: 'FORM_2_FILL',
        content: {
          items: [
            {
              id: 1,
              label: '1',
              // Giáo viên gõ nhiều đáp án cách nhau bởi dấu gạch chéo / hoặc chấm phẩy ;
              correctAnswers: 'study / learn ; revise hoặc do homework',
            },
            {
              id: 2,
              label: '2',
              correctAnswers: '7.15 / 7:15',
            },
          ],
        },
      }

      // Học sinh 1 chọn "learn" và "7:15"
      const res1 = gradeAnswersLocally(customTask, { '1': 'learn', '2': '7:15' }, 1)
      expect(res1.score).toBe(100)
      expect(res1.correct_count).toBe(2)

      // Học sinh 2 chọn "study" và "7.15." (có dấu chấm đuôi)
      const res2 = gradeAnswersLocally(customTask, { '1': 'study', '2': '7.15.' }, 1)
      expect(res2.score).toBe(100)
      expect(res2.correct_count).toBe(2)

      // Học sinh 3 chọn "do homework" và "7h15"
      const res3 = gradeAnswersLocally(customTask, { '1': 'do homework', '2': '7h15' }, 1)
      expect(res3.score).toBe(100)
      expect(res3.correct_count).toBe(2)
    })
  })
})
