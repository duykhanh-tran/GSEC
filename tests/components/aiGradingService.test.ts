import { describe, expect, it } from 'vitest'
import {
  checkRequiredKeywords,
  detectGibberish,
  evaluateSentenceHeuristically,
  evaluateParagraphHeuristically,
  normalizeToken,
} from '../../src/lib/aiGradingService'
import { checkSentenceLexicon, checkConcatenatedToken } from '../../src/lib/englishLexicon'
import type { WritingItemConfig } from '../../src/task-engine/dynamic-schema'

describe('aiGradingService - Step 1: checkRequiredKeywords', () => {
  it('normalizes tokens and removes punctuation correctly', () => {
    expect(normalizeToken('badminton.')).toBe('badminton')
    expect(normalizeToken('“usually”')).toBe('usually')
    expect(normalizeToken('PLAY!')).toBe('play')
  })

  it('passes when all required words are included in the sentence', () => {
    const res = checkRequiredKeywords(
      'I usually play badminton after school.',
      ['usually', 'badminton']
    )
    expect(res.passed).toBe(true)
    expect(res.missingWords).toHaveLength(0)
    expect(res.foundWords).toContain('usually')
    expect(res.foundWords).toContain('badminton')
  })

  it('handles multi-word phrases correctly', () => {
    const res = checkRequiredKeywords(
      'There is a pencil sharpener on the table.',
      ['pencil sharpener']
    )
    expect(res.passed).toBe(true)
    expect(res.missingWords).toHaveLength(0)
  })

  it('detects missing required words and reports them clearly', () => {
    const res = checkRequiredKeywords(
      'I play tennis every Sunday.',
      ['usually', 'badminton']
    )
    expect(res.passed).toBe(false)
    expect(res.missingWords).toEqual(['usually', 'badminton'])
  })

  it('detects partially missing required words', () => {
    const res = checkRequiredKeywords(
      'I usually play tennis.',
      ['usually', 'badminton']
    )
    expect(res.passed).toBe(false)
    expect(res.missingWords).toEqual(['badminton'])
    expect(res.foundWords).toEqual(['usually'])
  })
})

describe('aiGradingService - Step 2: evaluateSentenceHeuristically fallback', () => {
  const mockItem: WritingItemConfig = {
    id: 'q1',
    label: 'Question 1',
    prompt: 'Write a sentence with usually and badminton.',
    required_words: ['usually', 'badminton'],
    min_words: 4,
  }

  it('flags sentence that is too short', () => {
    const res = evaluateSentenceHeuristically('I play badminton.', mockItem)
    expect(res.is_correct).toBe(false)
    expect(res.error_type).toBe('meaning')
  })

  it('flags subject-verb agreement errors', () => {
    const res = evaluateSentenceHeuristically(
      'He usually play badminton after school.',
      mockItem
    )
    expect(res.is_correct).toBe(false)
    expect(res.error_type).toBe('grammar')
    expect(res.feedback_vi).toContain('số ít')
  })

  it('detects gibberish / nonsensical text and rejects it', () => {
    expect(detectGibberish('I have sjnvldkfjvblkjdfb').isGibberish).toBe(true)
    expect(detectGibberish('asdfghjkl').isGibberish).toBe(true)
    expect(detectGibberish('This is a pencil').isGibberish).toBe(false)

    const res = evaluateSentenceHeuristically(
      'I also have sjnvldkfjvblkjdfb .',
      mockItem
    )
    expect(res.is_correct).toBe(false)
    expect(res.error_type).toBe('gibberish')
    expect(res.score).toBe(0)
  })

  it('detects concatenated words without space (fourpen, myschool, inmy)', () => {
    const c1 = checkConcatenatedToken('fourpen')
    expect(c1.hasError).toBe(true)
    expect(c1.errorType).toBe('concatenated')
    expect(c1.suggestion).toBe('four pen')

    const c2 = checkConcatenatedToken('myschool')
    expect(c2.hasError).toBe(true)
    expect(c2.errorType).toBe('concatenated')

    const c3 = checkConcatenatedToken('fourlpen')
    expect(c3.hasError).toBe(true)
    expect(['concatenated_typo', 'spelling']).toContain(c3.errorType)

    // Tests through evaluateSentenceHeuristically
    const resFourlpen = evaluateSentenceHeuristically('I also have fourlpen .', mockItem)
    expect(resFourlpen.is_correct).toBe(false)
    expect(resFourlpen.error_type).toBe('spelling')
    expect(resFourlpen.feedback_vi).toContain('fourlpen')

    const resFourpen = evaluateSentenceHeuristically('I also have fourpen .', mockItem)
    expect(resFourpen.is_correct).toBe(false)
    expect(resFourpen.error_type).toBe('spelling')
    expect(resFourpen.feedback_vi).toContain('dính liền')
  })

  it('detects missing plural after numbers > 1 (e.g. two pen, four pen)', () => {
    const resTwoPen = evaluateSentenceHeuristically('I also have two pen .', mockItem)
    expect(resTwoPen.is_correct).toBe(false)
    expect(resTwoPen.error_type).toBe('grammar')
    expect(resTwoPen.feedback_vi).toContain('số nhiều')

    const resFourPens = evaluateSentenceHeuristically('I also have four pens.', mockItem)
    expect(resFourPens.is_correct).toBe(true)
  })

  it('rejects severe grammatical errors such as feel is a excited', () => {
    const res = evaluateSentenceHeuristically(
      'I feel is a excited at school.',
      mockItem
    )
    expect(res.is_correct).toBe(false)
    expect(res.error_type).toBe('grammar')
    expect(res.feedback_vi).toContain('feel')
  })

  it('tolerates missing final period if sentence is grammatically valid', () => {
    const res = evaluateSentenceHeuristically(
      'I usually play badminton after school',
      mockItem
    )
    expect(res.is_correct).toBe(true)
    expect(res.score).toBe(95)
    expect(res.feedback_vi).toContain('dấu chấm')
  })

  it('flags missing punctuation and missing capitalization', () => {
    const res = evaluateSentenceHeuristically(
      'i usually play badminton with my friends',
      mockItem
    )
    expect(res.is_correct).toBe(false)
    expect(res.error_type).toBe('punctuation')
  })

  it('passes a well-formed grammatical sentence', () => {
    const res = evaluateSentenceHeuristically(
      'I usually play badminton after school.',
      mockItem
    )
    expect(res.is_correct).toBe(true)
    expect(res.score).toBe(100)
    expect(res.error_type).toBe('none')
  })

  it('evaluates free sentence without required words correctly', () => {
    const freeItem: WritingItemConfig = {
      id: 'q1',
      label: 'Question 1',
      prompt: 'Write what you do after school.',
      // No required_words
    }
    const goodRes = evaluateSentenceHeuristically(
      'I usually play soccer with my friends in the afternoon.',
      freeItem
    )
    expect(goodRes.is_correct).toBe(true)
    expect(goodRes.score).toBe(100)

    const badRes = evaluateSentenceHeuristically(
      'he go home after school',
      freeItem
    )
    expect(badRes.is_correct).toBe(false)
  })
})

describe('aiGradingService - Paragraph Evaluation (evaluateParagraphHeuristically)', () => {
  it('flags paragraph that does not meet minimum word count', () => {
    const config = {
      prompt: 'Write about your school.',
      min_words: 20,
      max_words: 60,
    }
    const res = evaluateParagraphHeuristically('My school is big. I like it.', config)
    expect(res.is_correct).toBe(false)
    expect(res.word_count).toBeLessThan(20)
    expect(res.feedback_vi).toContain('chưa đạt yêu cầu tối thiểu')
  })

  it('evaluates a well-written paragraph that meets criteria', () => {
    const config = {
      prompt: 'Write about your school.',
      min_words: 20,
      max_words: 60,
      helper_words: ['library', 'classmates'],
      criteria: ['Introduce school', 'Mention favorite place'],
    }
    const paragraph =
      'My school is Nguyen Du Secondary School. It has a large library with many books. I often read there with my classmates every afternoon. I love my school very much.'

    const res = evaluateParagraphHeuristically(paragraph, config)
    expect(res.is_correct).toBe(true)
    expect(res.score).toBeGreaterThanOrEqual(80)
    expect(res.criteria_evaluations).toBeDefined()
    expect(res.criteria_evaluations?.length).toBe(2)
    expect(res.criteria_evaluations?.[0].passed).toBe(true)
  })

  it('provides helpful suggestions when punctuation or capitalization is missing', () => {
    const config = {
      prompt: 'Write about your weekend.',
      min_words: 15,
      max_words: 50,
    }
    const res = evaluateParagraphHeuristically(
      'on the weekend I like to play games with my brother at home and we eat pizza together',
      config
    )
    expect(res.suggestions).toBeDefined()
    expect(res.suggestions?.some((s) => s.includes('viết hoa') || s.includes('dấu chấm'))).toBe(true)
  })
})

