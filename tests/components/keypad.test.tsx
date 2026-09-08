import { act, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CodeKeypad } from '../../src/components/keypad/CodeKeypad'

afterEach(() => {
  vi.useRealTimers()
  document.body.style.overflow = ''
})

describe('shared five-digit keypad', () => {
  it('navigates automatically when a valid five-digit code is entered', () => {
    vi.useFakeTimers()
    const onNavigate = vi.fn()
    render(<CodeKeypad mode="inline" onNavigate={onNavigate} />)

    for (const digit of ['6', '0', '1', '5', '4']) {
      fireEvent.click(screen.getByRole('button', { name: `Số ${digit}` }))
    }
    expect(onNavigate).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(120))
    expect(onNavigate).toHaveBeenCalledOnce()
    expect(onNavigate).toHaveBeenCalledWith('60154')
  })

  it('shows the entered invalid code and supports Backspace', () => {
    vi.useFakeTimers()
    render(<CodeKeypad mode="inline" onNavigate={vi.fn()} />)

    for (let index = 0; index < 5; index += 1) {
      fireEvent.keyDown(document, { key: '9' })
    }
    act(() => vi.advanceTimersByTime(120))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Không tìm thấy task có mã 99999.',
    )
    fireEvent.keyDown(document, { key: 'Backspace' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Mã task đã nhập: 9999')).toBeInTheDocument()
  })

  it('provides modal semantics, scroll lock, Escape and focus return', () => {
    vi.useFakeTimers()
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const returnFocusRef = createRef<HTMLButtonElement>()
    returnFocusRef.current = trigger
    const onClose = vi.fn()

    const { unmount } = render(
      <CodeKeypad
        mode="modal"
        dialogId="number-keypad"
        returnFocusRef={returnFocusRef}
        onRequestClose={onClose}
        onNavigate={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    expect(document.body.style.overflow).toBe('hidden')
    act(() => vi.runOnlyPendingTimers())
    expect(screen.getByRole('button', { name: 'Số 1' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    unmount()
    expect(document.body.style.overflow).toBe('')
    expect(trigger).toHaveFocus()
    trigger.remove()
  })
})
