import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCelebrationSound } from '../../src/hooks/useCelebrationSound'

class FakeAudioParam {
  setValueAtTime = vi.fn()
  exponentialRampToValueAtTime = vi.fn()
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  currentTime = 1
  destination = {}
  close = vi.fn().mockResolvedValue(undefined)
  oscillators: Array<{ connect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; frequency: FakeAudioParam; type: OscillatorType }> = []

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  createOscillator() {
    const oscillator = { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: new FakeAudioParam(), type: 'sine' as OscillatorType }
    this.oscillators.push(oscillator)
    return oscillator
  }

  createGain() {
    return { connect: vi.fn(), gain: new FakeAudioParam() }
  }
}

describe('useCelebrationSound', () => {
  const originalAudioContext = window.AudioContext

  afterEach(() => {
    vi.useRealTimers()
    FakeAudioContext.instances = []
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: originalAudioContext })
  })

  it('plays one three-note chime when completion becomes active', () => {
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext })
    const { rerender } = renderHook(({ active }) => useCelebrationSound(active), { initialProps: { active: false } })

    rerender({ active: true })
    rerender({ active: true })

    expect(FakeAudioContext.instances).toHaveLength(1)
    expect(FakeAudioContext.instances[0].oscillators).toHaveLength(3)
    expect(FakeAudioContext.instances[0].oscillators.every((oscillator) => oscillator.start.mock.calls.length === 1)).toBe(true)
  })

  it('closes its audio context after the sound and on unmount', () => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext })
    const first = renderHook(() => useCelebrationSound(true))
    const firstContext = FakeAudioContext.instances[0]

    act(() => vi.advanceTimersByTime(900))
    expect(firstContext.close).toHaveBeenCalledTimes(1)
    first.unmount()

    const second = renderHook(() => useCelebrationSound(true))
    const secondContext = FakeAudioContext.instances[1]
    second.unmount()
    expect(secondContext.close).toHaveBeenCalledTimes(1)
  })
})
