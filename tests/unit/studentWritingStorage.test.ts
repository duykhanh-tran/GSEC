import { beforeEach, describe, expect, it } from 'vitest'
import {
  getApprovedWriting,
  saveApprovedWriting,
} from '../../src/lib/studentWritingStorageService'

describe('Student Writing Storage Service', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves approved sentences and retrieves them correctly', async () => {
    const sentences = [
      'My school is Tran Quoc Toan School.',
      'In my school bag, I have a ruler.',
    ]

    const saveResult = await saveApprovedWriting('60115', sentences, 'Full paragraph here')
    expect(saveResult.success).toBe(true)

    const retrieved = await getApprovedWriting('60115')
    expect(retrieved.found).toBe(true)
    expect(retrieved.sentences).toEqual(sentences)
    expect(retrieved.paragraph).toBe('Full paragraph here')
    expect(retrieved.taskCode).toBe('60115')
  })

  it('rejects unverified raw answers and only accepts verified sentences', async () => {
    // Simulating old unverified raw answers stored in localStorage
    localStorage.setItem(
      'gsec_approved_writing_60115',
      JSON.stringify({
        approved_sentences: [],
        raw_draft: 'my school is wrong',
      })
    )

    const result = await getApprovedWriting('60115')
    expect(result.found).toBe(false)
    expect(result.sentences).toEqual([])
  })

  it('returns found: false when no writing was saved for the linked task', async () => {
    const result = await getApprovedWriting('99999')
    expect(result.found).toBe(false)
    expect(result.sentences).toEqual([])
  })
})
