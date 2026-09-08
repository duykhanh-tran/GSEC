import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAutoScroll } from '../../src/hooks/useAutoScroll'
import { useRecordingSimulation } from '../../src/hooks/useRecordingSimulation'
import { useTaskTimers } from '../../src/hooks/useTaskTimers'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('locked side-effect hooks', () => {
  it('cancels scheduled task callbacks on unmount', () => {
    vi.useFakeTimers()
    const callback = vi.fn()
    const { result, unmount } = renderHook(() => useTaskTimers())
    act(() => result.current(callback, 500))
    unmount()
    act(() => vi.advanceTimersByTime(500))
    expect(callback).not.toHaveBeenCalled()
  })

  it('runs the recording simulation deterministically', () => {
    vi.useFakeTimers()
    const done = vi.fn()
    const { result } = renderHook(() => useRecordingSimulation(done))
    act(() => result.current.start())
    expect(result.current.status).toBe('recording')
    act(() => vi.advanceTimersByTime(1200))
    expect(result.current.status).toBe('converting')
    act(() => vi.advanceTimersByTime(500))
    expect(result.current.status).toBe('done')
    expect(done).toHaveBeenCalledOnce()
  })

  it('cancels auto-scroll when the owner unmounts', () => {
    vi.useFakeTimers()
    const scrollIntoView = vi.fn()
    const { result, unmount } = renderHook(() => useAutoScroll('first'))
    act(() => result.current.scrollToLatest({ scrollIntoView } as unknown as Element))
    unmount()
    act(() => vi.advanceTimersByTime(60))
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})
