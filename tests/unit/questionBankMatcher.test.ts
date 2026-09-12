import { describe, expect, it } from 'vitest'
import {
  normalizeText,
  tokenize,
  calculateTokenOverlap,
  matchQuestionToField,
  checkProfileAnswerMatch,
} from '../../src/lib/questionBankMatcher'
import type { Form62InterviewFieldItem } from '../../src/task-engine/dynamic-schema'

describe('questionBankMatcher', () => {
  const sampleItems: Form62InterviewFieldItem[] = [
    {
      id: 'name',
      label: 'Name',
      target_answer: 'Nam',
      accepted_values: ['Nam', 'his name is Nam'],
      answer_audio_url: 'https://example.com/name.mp3',
      question_bank: [
        'What is his name?',
        "What's his name?",
        'Who is he?',
        'Can you tell me his name?',
      ],
    },
    {
      id: 'class',
      label: 'Class',
      target_answer: '6A',
      accepted_values: ['6A', 'class 6A'],
      answer_audio_url: 'https://example.com/class.mp3',
      question_bank: [
        'Which class is he in?',
        'What class is he in?',
        'What is his class?',
      ],
    },
    {
      id: 'subject',
      label: 'Favourite subject',
      target_answer: 'English',
      accepted_values: ['English', 'his favourite subject is English'],
      answer_audio_url: 'https://example.com/subject.mp3',
      question_bank: [
        'What is his favourite subject?',
        "What's his favorite subject?",
        'Which subject does he like?',
      ],
    },
    {
      id: 'activity',
      label: 'Activity after',
      target_answer: 'play football',
      accepted_values: ['play football', 'plays football'],
      answer_audio_url: 'https://example.com/activity.mp3',
      question_bank: [
        'What does he do after school?',
        'What is his activity after school?',
        'What does he usually do after school?',
      ],
    },
  ]

  describe('normalizeText and tokenize', () => {
    it('normalizes punctuation and lowercase', () => {
      expect(normalizeText("What's his name?")).toBe('whats his name')
      expect(normalizeText('Class 6A!')).toBe('class 6a')
      expect(tokenize("What's his name?")).toEqual(['whats', 'his', 'name'])
    })

    it('calculates token overlap correctly', () => {
      const overlap = calculateTokenOverlap(['what', 'is', 'his', 'name'], ['what', 'is', 'his', 'class'])
      expect(overlap).toBeGreaterThan(0.5)
    })
  })

  describe('matchQuestionToField', () => {
    it('matches exact question in question bank', () => {
      const res = matchQuestionToField("What's his name?", sampleItems)
      expect(res.matchedFieldId).toBe('name')
      expect(res.confidence).toBe(1.0)
    })

    it('matches question with slight variation via intent/tokens', () => {
      const resName = matchQuestionToField('Please tell me the name of this boy', sampleItems)
      expect(resName.matchedFieldId).toBe('name')

      const resClass = matchQuestionToField('Which class is he in now?', sampleItems)
      expect(resClass.matchedFieldId).toBe('class')

      const resSubject = matchQuestionToField('What subject does he like most?', sampleItems)
      expect(resSubject.matchedFieldId).toBe('subject')

      const resActivity = matchQuestionToField('What does he play after school?', sampleItems)
      expect(resActivity.matchedFieldId).toBe('activity')
    })

    it('returns null for unrelated or empty questions', () => {
      const res1 = matchQuestionToField('', sampleItems)
      expect(res1.matchedFieldId).toBeNull()

      const res2 = matchQuestionToField('How much is the weather today in Hanoi?', sampleItems)
      expect(res2.matchedFieldId).toBeNull()

      const res3 = matchQuestionToField("What's your favourite food?", sampleItems)
      expect(res3.matchedFieldId).toBeNull()
    })
  })

  describe('checkProfileAnswerMatch', () => {
    it('validates short answers and full sentences', () => {
      // Name
      expect(checkProfileAnswerMatch('Nam', 'Nam', ['his name is Nam'])).toBe(true)
      expect(checkProfileAnswerMatch('His name is Nam', 'Nam', ['his name is Nam'])).toBe(true)
      expect(checkProfileAnswerMatch('nam', 'Nam')).toBe(true)
      expect(checkProfileAnswerMatch('Lan', 'Nam')).toBe(false)

      // Class
      expect(checkProfileAnswerMatch('6A', '6A', ['class 6A'])).toBe(true)
      expect(checkProfileAnswerMatch('He is in class 6A', '6A')).toBe(true)
      expect(checkProfileAnswerMatch('7B', '6A')).toBe(false)

      // Subject
      expect(checkProfileAnswerMatch('English', 'English')).toBe(true)
      expect(checkProfileAnswerMatch('his favourite subject is English', 'English')).toBe(true)

      // Activity
      expect(checkProfileAnswerMatch('play football', 'play football')).toBe(true)
      expect(checkProfileAnswerMatch('he plays football', 'play football', ['plays football'])).toBe(true)
      expect(checkProfileAnswerMatch('read books', 'play football')).toBe(false)
    })
  })
})
