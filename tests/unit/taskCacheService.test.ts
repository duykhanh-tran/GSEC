import { describe, expect, it, vi, beforeEach } from 'vitest'
import { taskCacheService, getOptimizedAudioSrc } from '../../src/lib/taskCacheService'

describe('taskCacheService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('getOptimizedAudioSrc', () => {
    it('returns empty string when input is empty or undefined', () => {
      expect(getOptimizedAudioSrc('')).toBe('')
      expect(getOptimizedAudioSrc(undefined)).toBe('')
    })

    it('returns original URL for non-data audio URLs', () => {
      const httpUrl = 'https://example.com/audio.mp3'
      expect(getOptimizedAudioSrc(httpUrl)).toBe(httpUrl)

      const relativeUrl = '/assets/audio.mp3'
      expect(getOptimizedAudioSrc(relativeUrl)).toBe(relativeUrl)
    })

    it('converts base64 data audio URL to Blob Object URL and caches it', () => {
      // Mock createObjectURL
      const mockBlobUrl = 'blob:http://localhost/test-blob-123'
      const createObjectURLMock = vi.fn().mockReturnValue(mockBlobUrl)
      global.URL.createObjectURL = createObjectURLMock

      // Tiny valid base64 audio snippet
      const base64Audio = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA'
      const result1 = getOptimizedAudioSrc(base64Audio)

      expect(result1).toBe(mockBlobUrl)
      expect(createObjectURLMock).toHaveBeenCalledTimes(1)

      // Second call with the same base64 string should return cached blob url immediately without creating another blob
      const result2 = getOptimizedAudioSrc(base64Audio)
      expect(result2).toBe(mockBlobUrl)
      expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('TaskCacheService memory cache', () => {
    it('returns undefined for non-cached task code', () => {
      expect(taskCacheService.getFromMemory('99998')).toBeUndefined()
    })

    it('allows invalidating cached tasks', async () => {
      await taskCacheService.invalidateTask('60111')
      expect(taskCacheService.getFromMemory('60111')).toBeUndefined()
    })

    it('handles prefetchTask and preloadTasksBatch safely', () => {
      expect(() => taskCacheService.prefetchTask('')).not.toThrow()
      expect(() => taskCacheService.prefetchTask('12')).not.toThrow()
      expect(() => taskCacheService.preloadTasksBatch([])).not.toThrow()
      expect(() => taskCacheService.preloadTasksBatch(['60111', '60112'])).not.toThrow()
    })
  })
})
