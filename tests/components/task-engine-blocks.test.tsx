import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AnswerChoiceMatrix } from '../../src/components/answers/AnswerChoiceMatrix'
import { Celebration } from '../../src/components/effects/Celebration'
import { PlaybackSequence } from '../../src/components/listening/PlaybackSequence'
import { GuidedIndependentStatus } from '../../src/components/progress/GuidedIndependentStatus'
import { MasteryGate } from '../../src/components/progress/MasteryGate'
import { ProgressSteps } from '../../src/components/progress/ProgressSteps'
import { ScoreGrid } from '../../src/components/progress/ScoreGrid'
import { RecordingCard } from '../../src/components/recording/RecordingCard'
import { RetryPanel } from '../../src/components/retry/RetryPanel'
import { useRetryQueue } from '../../src/hooks/useRetryQueue'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('task engine blocks', () => {
  it('renders an accessible choice matrix and reports row changes', async () => {
    const onChange = vi.fn()
    render(<AnswerChoiceMatrix rows={[{ id: 1, prompt: 'Choose', options: [{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }] }]} values={{}} onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: 'B' }))
    expect(onChange).toHaveBeenCalledWith('1', 'B')
  })

  it('preserves retry selectors and field callbacks', async () => {
    const onFieldChange = vi.fn()
    render(<RetryPanel title="Question 2" tag="FORM" prompt="She ___" hint="Check the subject" attempt={1} question={2} fields={[{ id: 0, placeholder: 'Try again', value: '' }]} onFieldChange={onFieldChange} onCheck={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText('Try again'), 'goes')
    expect(onFieldChange).toHaveBeenLastCalledWith(0, 's')
    expect(document.querySelector("[data-question='2'][data-attempt='1']")).toBeInTheDocument()
  })

  it('runs the shared recording card through transcript confirmation', () => {
    vi.useFakeTimers()
    render(<RecordingCard label="Record" range="5s" stage="recording" transcript="Hello" onConfirm={vi.fn()} />)
    act(() => screen.getByRole('button', { name: 'Demo' }).click())
    act(() => vi.advanceTimersByTime(1700))
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yes, use this' })).toBeInTheDocument()
  })

  it('models progress, score, mastery and guided status without task knowledge', () => {
    render(<><ProgressSteps steps={[{ id: 'a', label: 'Listen', status: 'complete' }, { id: 'b', label: 'Speak', status: 'active' }]} /><ScoreGrid items={[{ id: 'score', label: 'Revised', value: '9/10' }]} /><MasteryGate mastered>Ready</MasteryGate><GuidedIndependentStatus mode="guided" /></>)
    expect(screen.getByText('9/10')).toBeInTheDocument()
    expect(screen.getByText('Mastery ✓')).toBeInTheDocument()
    expect(screen.getByText('Guided')).toHaveAttribute('data-learning-mode', 'guided')
  })

  it('plays a listening sequence once and exposes the replay state', () => {
    vi.useFakeTimers()
    const speak = vi.fn()
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn() })
    vi.stubGlobal('SpeechSynthesisUtterance', class { lang = ''; rate = 1; constructor(public text: string) {} })
    render(<PlaybackSequence items={['one', 'two']} intervalMs={100} />)
    const play = screen.getByRole('button', { name: 'Play sequence' })
    fireEvent.click(play)
    expect(play).toBeDisabled()
    act(() => vi.advanceTimersByTime(200))
    expect(speak).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Play again' })).toBeEnabled()
  })

  it('cleans up celebration and retry queue state', () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    const { unmount } = render(<Celebration active durationMs={100} count={3} onComplete={onComplete} />)
    expect(document.querySelectorAll('.celebration-piece')).toHaveLength(3)
    unmount()
    act(() => vi.advanceTimersByTime(100))
    expect(onComplete).not.toHaveBeenCalled()

    const queue = renderHook(() => useRetryQueue<number>())
    act(() => queue.result.current.start([2, 8]))
    expect(queue.result.current.current).toBe(2)
    act(() => queue.result.current.nextAttempt())
    expect(queue.result.current.attempt).toBe(2)
    act(() => queue.result.current.resolveCurrent())
    expect(queue.result.current.current).toBe(8)
  })
})
