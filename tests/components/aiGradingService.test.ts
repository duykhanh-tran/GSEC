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

  it('enforces strict scoring criteria such as mandatory full stop when configured by teacher', () => {
    // Normal mode without strict criteria: missing period still counts as correct (score 95) with reminder
    const lenientRes = evaluateSentenceHeuristically(
      'I usually play badminton after school',
      mockItem,
    )
    expect(lenientRes.is_correct).toBe(true)

    // Strict criteria mode: teacher configured mandatory full stop / dấu chấm
    const strictRes = evaluateSentenceHeuristically(
      'I usually play badminton after school',
      mockItem,
      'Bắt buộc kết thúc bằng dấu chấm câu'
    )
    expect(strictRes.is_correct).toBe(false)
    expect(strictRes.error_type).toBe('punctuation')
    expect(strictRes.feedback_vi).toContain('dấu chấm')
  })

  it('enforces item-level scoring criteria when configured per question', () => {
    const itemWithCriteria: WritingItemConfig = {
      ...mockItem,
      scoring_criteria: 'Yêu cầu viết hoa chữ cái đầu câu nghiêm ngặt',
    }
    const strictCapRes = evaluateSentenceHeuristically(
      'i usually play badminton after school.',
      itemWithCriteria,
    )
    expect(strictCapRes.is_correct).toBe(false)
    expect(strictCapRes.feedback_vi).toContain('viết hoa')
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

  it('correctly accepts Vietnamese proper names like Toan, Doan, Khoa without confusing them with to an or do an', () => {
    // 1. Kiểm tra cấp độ Lexicon / Token
    const toanCheck = checkConcatenatedToken('Toan')
    expect(toanCheck.hasError).toBe(false)

    const lowerToanCheck = checkConcatenatedToken('toan')
    expect(lowerToanCheck.hasError).toBe(false)

    const doanCheck = checkConcatenatedToken('Doan')
    expect(doanCheck.hasError).toBe(false)

    const khoaCheck = checkConcatenatedToken('Khoa')
    expect(khoaCheck.hasError).toBe(false)

    // 2. Kiểm tra cấp độ câu đầy đủ
    const lexCheckToan = checkSentenceLexicon('Toan is my friend.')
    expect(lexCheckToan.hasError).toBe(false)

    const lexCheckWithToan = checkSentenceLexicon('I usually play badminton with Toan.')
    expect(lexCheckWithToan.hasError).toBe(false)

    // 3. Đánh giá câu có chứa Toan
    const resToanSubject = evaluateSentenceHeuristically(
      'Toan usually plays badminton with my brother.',
      mockItem
    )
    expect(resToanSubject.is_correct).toBe(true)
    expect(resToanSubject.score).toBe(100)

    const resWithToan = evaluateSentenceHeuristically(
      'I usually play badminton with Toan.',
      mockItem
    )
    expect(resWithToan.is_correct).toBe(true)
    expect(resWithToan.score).toBe(100)

    const resDoan = evaluateSentenceHeuristically(
      'Doan usually plays badminton after school.',
      mockItem
    )
    expect(resDoan.is_correct).toBe(true)
    expect(resDoan.score).toBe(100)

    const freeItem: WritingItemConfig = {
      id: 'q_name',
      label: 'Question',
      prompt: 'Write about your friend.',
    }
    const resFriendToan = evaluateSentenceHeuristically(
      'Toan is my best friend at school.',
      freeItem
    )
    expect(resFriendToan.is_correct).toBe(true)
    expect(resFriendToan.score).toBe(100)
  })

  it('strictly retains rigorous grading for real concatenated English words and grammar errors', () => {
    // 1. Từ dính chữ thực sự (concatenated words) phải BỊ TỪ CHỐI
    const resFourpen = evaluateSentenceHeuristically('I also have fourpen.', mockItem)
    expect(resFourpen.is_correct).toBe(false)
    expect(resFourpen.error_type).toBe('spelling')

    const resGotoschool = evaluateSentenceHeuristically('I usually gotoschool by bike.', mockItem)
    expect(resGotoschool.is_correct).toBe(false)

    const resMyschool = evaluateSentenceHeuristically('myschool is very beautiful.', mockItem)
    expect(resMyschool.is_correct).toBe(false)

    const resInmy = evaluateSentenceHeuristically('There is a ruler inmy backpack.', mockItem)
    expect(resInmy.is_correct).toBe(false)

    // 2. Lỗi hòa hợp số nhiều (plural agreement) phải BỊ TỪ CHỐI
    const resFourPen = evaluateSentenceHeuristically('I have four pen.', mockItem)
    expect(resFourPen.is_correct).toBe(false)
    expect(resFourPen.error_type).toBe('grammar')

    // 3. Lỗi động từ kép / cấu trúc câu sai phải BỊ TỪ CHỐI
    const resFeelIs = evaluateSentenceHeuristically('I feel is a excited today.', mockItem)
    expect(resFeelIs.is_correct).toBe(false)
    expect(resFeelIs.error_type).toBe('grammar')
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

