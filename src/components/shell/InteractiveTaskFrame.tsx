import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'

import type { TaskDefinition } from '../../app/task-types'
import { CodeKeypadModal } from '../keypad/CodeKeypadModal'
import { AppShell } from './AppShell'
import { TutorHeader } from './TutorHeader'

interface InteractiveTaskFrameProps {
  task: TaskDefinition
  className: string
  chatRef?: RefObject<HTMLElement | null>
  footer: ReactNode
  children: ReactNode
}

export function InteractiveTaskFrame({
  task,
  className,
  chatRef,
  footer,
  children,
}: InteractiveTaskFrameProps) {
  const navigate = useNavigate()
  const [isKeypadOpen, setIsKeypadOpen] = useState(false)
  const keypadTriggerRef = useRef<HTMLButtonElement>(null)
  const keypadId = useId()
  const [saveNotice, setSaveNotice] = useState<{ text: string; isWarn?: boolean } | null>(null)

  useEffect(() => {
    document.title = `${task.title} · React`
  }, [task.title])

  useEffect(() => {
    let timer: any = null
    const handleAttemptSaved = (event: Event) => {
      const customEvent = event as CustomEvent
      const { taskCode, score, firstScore, isCompleted, isGuest } = customEvent.detail || {}
      if (taskCode !== task.code) return

      if (isGuest) {
        setSaveNotice({
          text: 'Khách (chưa đăng nhập): Hãy đăng nhập để lưu điểm báo cáo Giáo viên.',
          isWarn: true,
        })
      } else if (isCompleted) {
        setSaveNotice({
          text: `Đã lưu kết quả: ${score}/100đ ${firstScore !== undefined ? `(Lần 1: ${firstScore}đ)` : ''} • Đã báo cáo GV & Admin ✓`,
        })
      } else {
        setSaveNotice({
          text: `Đã lưu lần 1: ${score}/100đ • Đang làm dở`,
        })
      }

      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        setSaveNotice(null)
      }, 4000)
    }

    window.addEventListener('task-attempt-saved', handleAttemptSaved)
    return () => {
      window.removeEventListener('task-attempt-saved', handleAttemptSaved)
      if (timer) clearTimeout(timer)
    }
  }, [task.code])

  return (
    <>
      <AppShell
        className={className}
        taskCode={task.code}
        moduleReady
        chatRef={chatRef}
        header={
          <TutorHeader
            task={task}
            keypadId={keypadId}
            keypadTriggerRef={keypadTriggerRef}
            onOpenKeypad={() => setIsKeypadOpen(true)}
          />
        }
        footer={footer}
      >
        {children}
      </AppShell>

      {saveNotice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '16px',
            right: '20px',
            zIndex: 9999,
            backgroundColor: saveNotice.isWarn ? '#fef3c7' : '#0f172a',
            color: saveNotice.isWarn ? '#92400e' : '#ffffff',
            border: saveNotice.isWarn ? '1px solid #fde68a' : '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
            padding: '10px 18px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: '90vw',
            pointerEvents: 'none',
          }}
        >
          <span>{saveNotice.isWarn ? '⚠️' : '💾'}</span>
          <span>{saveNotice.text}</span>
        </div>
      )}

      <CodeKeypadModal
        dialogId={keypadId}
        isOpen={isKeypadOpen}
        returnFocusRef={keypadTriggerRef}
        onClose={() => setIsKeypadOpen(false)}
        onNavigate={(code) => {
          setIsKeypadOpen(false)
          navigate(`/tasks/${code}`)
        }}
      />
    </>
  )
}
