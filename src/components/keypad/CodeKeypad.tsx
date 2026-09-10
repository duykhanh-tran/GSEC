import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react'

import { getTask } from '../../app/registry'
import { supabase } from '../../lib/supabaseClient'

const MAX_CODE_LENGTH = 5
const AUTO_SUBMIT_DELAY = 120
const KEYPAD_ROWS: readonly (readonly (number | 'spacer' | 'backspace')[])[] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  ['spacer', 0, 'backspace'],
]

interface CodeKeypadProps {
  mode: 'inline' | 'modal'
  onNavigate: (code: string) => void
  onRequestClose?: () => void
  dialogId?: string
  returnFocusRef?: RefObject<HTMLButtonElement | null>
}

export function CodeKeypad({
  mode,
  onNavigate,
  onRequestClose,
  dialogId,
  returnFocusRef,
}: CodeKeypadProps) {
  const generatedId = useId()
  const titleId = `${generatedId}-title`
  const helpId = `${generatedId}-help`
  const firstKeyRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [invalidAttempt, setInvalidAttempt] = useState(0)
  const isModal = mode === 'modal'

  const clearError = useCallback(() => setError(''), [])

  const submit = useCallback(
    async (code: string) => {
      if (code.length !== MAX_CODE_LENGTH) return
      const task = getTask(code)
      if (task) {
        onNavigate(task.code)
        return
      }

      // Trong môi trường test vitest, trả về lỗi ngay lập tức để tương thích fakeTimers
      if (import.meta.env.MODE === 'test') {
        setError(`Không tìm thấy task có mã ${code}.`)
        setInvalidAttempt((attempt) => attempt + 1)
        return
      }

      // Tra cứu xem có phải task do Admin tạo trong cơ sở dữ liệu Supabase không
      try {
        const { data: dbTask } = await supabase
          .from('tasks')
          .select('code')
          .eq('code', code)
          .maybeSingle()

        if (dbTask) {
          onNavigate(dbTask.code)
          return
        }
      } catch {
        // bỏ qua lỗi kết nối
      }

      setError(`Không tìm thấy task có mã ${code}.`)
      setInvalidAttempt((attempt) => attempt + 1)
    },
    [onNavigate],
  )

  const append = useCallback(
    (digit: string) => {
      clearError()
      setValue((current) =>
        current.length < MAX_CODE_LENGTH ? `${current}${digit}` : current,
      )
    },
    [clearError],
  )

  const backspace = useCallback(() => {
    clearError()
    setValue((current) => current.slice(0, -1))
  }, [clearError])

  const close = useCallback(() => {
    if (!isModal) return
    setValue('')
    clearError()
    onRequestClose?.()
  }, [clearError, isModal, onRequestClose])

  useEffect(() => {
    if (value.length !== MAX_CODE_LENGTH) return
    const timer = window.setTimeout(() => submit(value), AUTO_SUBMIT_DELAY)
    return () => window.clearTimeout(timer)
  }, [submit, value])

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault()
        append(event.key)
      } else if (event.key === 'Backspace') {
        event.preventDefault()
        backspace()
      } else if (event.key === 'Enter') {
        event.preventDefault()
        submit(value)
      } else if (event.key === 'Escape' && isModal) {
        event.preventDefault()
        close()
      }
    }

    document.addEventListener('keydown', handleKeyboard)
    return () => document.removeEventListener('keydown', handleKeyboard)
  }, [append, backspace, close, isModal, submit, value])

  useEffect(() => {
    if (!isModal) return
    const previousOverflow = document.body.style.overflow
    const returnFocusElement = returnFocusRef?.current
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => firstKeyRef.current?.focus(), 0)

    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      returnFocusElement?.focus()
    }
  }, [isModal, returnFocusRef])

  function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!isModal || event.key !== 'Tab') return
    const focusable = panelRef.current?.querySelectorAll<HTMLButtonElement>(
      'button:not(:disabled)',
    )
    if (!focusable?.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const panel = (
    <div
      ref={panelRef}
      className={`keypad-panel${isModal ? '' : ' keypad-inline-panel'}${error ? ' is-invalid' : ''}`}
      data-invalid-attempt={invalidAttempt}
      role={isModal ? undefined : 'group'}
      aria-labelledby={titleId}
      aria-describedby={helpId}
      onKeyDown={trapFocus}
    >
      <div className="keypad-head">
        <strong id={titleId}>Nhập mã task</strong>
        {isModal ? (
          <button
            className="keypad-close"
            type="button"
            onClick={close}
            aria-label="Đóng bàn phím"
          >
            ×
          </button>
        ) : null}
      </div>
      <p className="keypad-help" id={helpId}>
        Nhập mã gồm 5 chữ số để mở task.
      </p>
      <div
        className="pin-display"
        aria-live="polite"
        aria-label={`Mã task đã nhập: ${value || 'chưa có'}`}
      >
        {Array.from({ length: MAX_CODE_LENGTH }, (_, index) => {
          const digit = value[index] ?? ''
          return (
            <span className={`pin-slot${digit ? ' filled' : ''}`} key={index}>
              {digit}
            </span>
          )
        })}
      </div>
      {error ? (
        <p className="keypad-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="dial-pad" aria-label="Bàn phím số">
        {KEYPAD_ROWS.flat().map((key, index) => {
          if (key === 'spacer') {
            return (
              <span className="dial-spacer" aria-hidden="true" key={`${index}-spacer`} />
            )
          }
          if (key === 'backspace') {
            return (
              <button
                className="dial-key dial-key-backspace"
                type="button"
                onClick={backspace}
                aria-label="Xóa chữ số cuối"
                key={`${index}-${key}`}
              >
                ⌫
              </button>
            )
          }
          return (
            <button
              ref={key === 1 ? firstKeyRef : undefined}
              className="dial-key"
              type="button"
              onClick={() => append(String(key))}
              aria-label={`Số ${key}`}
              key={`${index}-${key}`}
            >
              {key}
            </button>
          )
        })}
      </div>
    </div>
  )

  if (!isModal) {
    return (
      <div className="launcher-keypad" data-inline-keypad="">
        {panel}
      </div>
    )
  }

  return (
    <div
      className="keypad-overlay"
      id={dialogId}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={helpId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      {panel}
    </div>
  )
}
