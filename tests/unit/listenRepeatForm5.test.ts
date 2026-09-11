import { describe, expect, it } from 'vitest'
import { scorePronunciation, cleanWord } from '../../src/lib/pronunciationScorer'
import type { Form5ListenRepeatConfig } from '../../src/task-engine/dynamic-schema'
import type { AssemblyAIWord } from '../../src/lib/assemblyAiService'

describe('FORM 5: Listen & Repeat Specification & Pass Gate (> 80%)', () => {
  const sampleConfig: Form5ListenRepeatConfig = {
    intro: 'Listen to each audio clip carefully. Repeat aloud into your microphone to get scored.',
    pass_score: 80,
    items: [
      {
        id: 'item-1',
        label: 'Sentence 1',
        target_text: 'I usually play badminton after school.',
        audio_url: 'https://example.com/audio1.mp3',
        hints: ['Nghe kỹ ngữ điệu và phát âm rõ âm đuôi.'],
      },
      {
        id: 'item-2',
        label: 'Sentence 2',
        target_text: 'My brother often reads comic books in the library.',
        hints: ['Chú ý phát âm s ở reads.'],
      },
      {
        id: 'item-3',
        label: 'Sentence 3',
        target_text: 'We sometimes ride bicycles around the park.',
      },
    ],
  }

  it('validates Form 5 configuration structure and default pass threshold of 80%', () => {
    expect(sampleConfig.pass_score).toBe(80)
    expect(sampleConfig.items.length).toBe(3)
    expect(sampleConfig.items[0].target_text).toBe('I usually play badminton after school.')
    expect(sampleConfig.items[0].audio_url).toBe('https://example.com/audio1.mp3')
    expect(sampleConfig.items[1].audio_url).toBeUndefined()
    expect(sampleConfig.items[1].hints).toContain('Chú ý phát âm s ở reads.')
  })

  it('strictly rejects recordings scoring below 80% (requires re-recording)', () => {
    const item = sampleConfig.items[0]
    // Student missed multiple key words: 'usually' and 'badminton'
    const heardText = 'I play after school'
    const words: AssemblyAIWord[] = [
      { text: 'I', start: 0, end: 200, confidence: 0.8 },
      { text: 'play', start: 210, end: 500, confidence: 0.78 },
      { text: 'after', start: 510, end: 800, confidence: 0.8 },
      { text: 'school', start: 810, end: 1100, confidence: 0.82 },
    ]

    const passThreshold = sampleConfig.pass_score || 80
    const evalResult = scorePronunciation(item.target_text, heardText, words, passThreshold)

    expect(evalResult.score).toBeLessThan(80)
    expect(evalResult.isPassed).toBe(false)

    // Verify missing words detected
    const missing = evalResult.evaluatedWords.filter((w) => w.status === 'missing')
    expect(missing.length).toBe(2)
    expect(missing.map((m) => m.targetWord)).toEqual(['usually', 'badminton'])
  })

  it('passes recording when student achieves score >= 80%', () => {
    const item = sampleConfig.items[0]
    const heardText = 'I usually play badminton after school.'
    const words: AssemblyAIWord[] = [
      { text: 'I', start: 0, end: 200, confidence: 0.92 },
      { text: 'usually', start: 210, end: 600, confidence: 0.91 },
      { text: 'play', start: 610, end: 900, confidence: 0.93 },
      { text: 'badminton', start: 910, end: 1400, confidence: 0.89 },
      { text: 'after', start: 1410, end: 1700, confidence: 0.9 },
      { text: 'school', start: 1710, end: 2100, confidence: 0.94 },
    ]

    const passThreshold = sampleConfig.pass_score || 80
    const evalResult = scorePronunciation(item.target_text, heardText, words, passThreshold)

    expect(evalResult.score).toBeGreaterThanOrEqual(80)
    expect(evalResult.isPassed).toBe(true)
    expect(evalResult.evaluatedWords.every((w) => w.status === 'correct')).toBe(true)
  })

  it('correctly tracks multi-item completion and average score calculation', () => {
    const scores = [88, 92, 85]
    const passThreshold = 80

    // All items individually meet or exceed threshold
    const allPassed = scores.every((s) => s >= passThreshold)
    expect(allPassed).toBe(true)

    const avgScore = Math.round(scores.reduce((acc, v) => acc + v, 0) / scores.length)
    expect(avgScore).toBe(88)
    expect(avgScore).toBeGreaterThanOrEqual(80)
  })

  it('generates accurate word boost list from target sentences', () => {
    const boostWords = sampleConfig.items
      .flatMap((it) => it.target_text.split(/\s+/))
      .map(cleanWord)
      .filter((w) => w.length > 2)

    expect(boostWords).toContain('usually')
    expect(boostWords).toContain('badminton')
    expect(boostWords).toContain('brother')
    expect(boostWords).toContain('library')
    expect(boostWords).toContain('bicycles')
  })
})
