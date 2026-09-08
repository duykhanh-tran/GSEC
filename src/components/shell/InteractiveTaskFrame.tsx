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

  useEffect(() => {
    document.title = `${task.title} · React`
  }, [task.title])

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
