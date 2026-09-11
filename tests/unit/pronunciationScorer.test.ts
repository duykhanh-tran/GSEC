import { describe, expect, it } from 'vitest'
import {
  cleanWord,
  scorePronunciation,
  alignWords,
} from '../../src/lib/pronunciationScorer'
import type { AssemblyAIWord } from '../../src/lib/assemblyAiService'

describe('Pronunciation Scorer & Sequence Alignment', () => {
  it('cleanWord strips punctuation and lowercases correctly', () => {
    expect(cleanWord('Hello,')).toBe('hello')
    expect(cleanWord('"School!"')).toBe('school')
    expect(cleanWord("don't")).toBe("don't")
    expect(cleanWord('  Teacher. ')).toBe('teacher')
  })

  it('awards 100 points for an exact sentence match with high confidence', () => {
    const target = 'My school is Tran Quoc Toan School.'
    const heardText = 'My school is Tran Quoc Toan School.'
    const words: AssemblyAIWord[] = [
      { text: 'My', start: 0, end: 300, confidence: 0.95 },
      { text: 'school', start: 310, end: 700, confidence: 0.94 },
      { text: 'is', start: 710, end: 900, confidence: 0.92 },
      { text: 'Tran', start: 910, end: 1200, confidence: 0.88 },
      { text: 'Quoc', start: 1210, end: 1500, confidence: 0.89 },
      { text: 'Toan', start: 1510, end: 1800, confidence: 0.91 },
      { text: 'School', start: 1810, end: 2200, confidence: 0.96 },
    ]

    const result = scorePronunciation(target, heardText, words, 80)
    expect(result.score).toBeGreaterThanOrEqual(95)
    expect(result.isPassed).toBe(true)
    expect(result.evaluatedWords.every((w) => w.status === 'correct')).toBe(true)
  })

  it('handles contractions and number equivalents', () => {
    const target = 'I have 2 pens.'
    const heardText = 'I have two pens.'
    const words: AssemblyAIWord[] = [
      { text: 'I', start: 0, end: 200, confidence: 0.9 },
      { text: 'have', start: 210, end: 500, confidence: 0.9 },
      { text: 'two', start: 510, end: 800, confidence: 0.85 },
      { text: 'pens', start: 810, end: 1100, confidence: 0.9 },
    ]

    const result = scorePronunciation(target, heardText, words, 80)
    expect(result.score).toBeGreaterThanOrEqual(88)
    expect(result.isPassed).toBe(true)
  })

  it('detects missing words and applies penalties', () => {
    const target = 'In my school bag I have a ruler'
    // Student skipped "school bag"
    const heardText = 'In my I have a ruler'
    const words: AssemblyAIWord[] = [
      { text: 'In', start: 0, end: 200, confidence: 0.9 },
      { text: 'my', start: 210, end: 400, confidence: 0.9 },
      { text: 'I', start: 410, end: 600, confidence: 0.9 },
      { text: 'have', start: 610, end: 900, confidence: 0.9 },
      { text: 'a', start: 910, end: 1000, confidence: 0.9 },
      { text: 'ruler', start: 1010, end: 1300, confidence: 0.9 },
    ]

    const result = scorePronunciation(target, heardText, words, 80)
    const missing = result.evaluatedWords.filter((w) => w.status === 'missing')
    expect(missing.length).toBe(2)
    expect(missing.map((m) => m.targetWord)).toEqual(['school', 'bag'])
    expect(result.score).toBeLessThan(80)
    expect(result.isPassed).toBe(false)
  })

  it('detects mispronounced words when text differs significantly', () => {
    const target = 'I feel excited at school'
    // Student said "bored" instead of "excited"
    const heardText = 'I feel bored at school'
    const words: AssemblyAIWord[] = [
      { text: 'I', start: 0, end: 200, confidence: 0.9 },
      { text: 'feel', start: 210, end: 500, confidence: 0.9 },
      { text: 'bored', start: 510, end: 800, confidence: 0.85 },
      { text: 'at', start: 810, end: 950, confidence: 0.9 },
      { text: 'school', start: 960, end: 1300, confidence: 0.9 },
    ]

    const result = scorePronunciation(target, heardText, words, 80)
    const mis = result.evaluatedWords.find((w) => w.targetWord === 'excited')
    expect(mis).toBeDefined()
    expect(mis?.status).toBe('mispronounced')
    expect(mis?.heardWord).toBe('bored')
  })

  it('marks word as unclear if confidence is between 0.45 and 0.74', () => {
    const target = 'happy'
    const words: AssemblyAIWord[] = [{ text: 'happy', start: 0, end: 400, confidence: 0.58 }]

    const result = scorePronunciation(target, 'happy', words, 80)
    expect(result.evaluatedWords[0].status).toBe('unclear')
  })

  it('returns 0 score when no words are recognized', () => {
    const target = 'My school is big'
    const result = scorePronunciation(target, '', [], 80)
    expect(result.score).toBe(0)
    expect(result.isPassed).toBe(false)
    expect(result.evaluatedWords.every((w) => w.status === 'missing')).toBe(true)
  })
})
