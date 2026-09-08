import type { RefObject } from 'react'

import type { TaskDefinition } from '../../app/task-types'
import { TutorAvatar } from '../chat/TutorAvatar'

interface TutorHeaderProps {
  task: TaskDefinition
  keypadId: string
  keypadTriggerRef: RefObject<HTMLButtonElement | null>
  onOpenKeypad: () => void
}

export function TutorHeader({
  task,
  keypadId,
  keypadTriggerRef,
  onOpenKeypad,
}: TutorHeaderProps) {
  return (
    <header className="topbar">
      <TutorAvatar />
      <div className="meta">
        <h1>{task.title}</h1>
        <p>{task.subtitle}</p>
      </div>
      <button
        ref={keypadTriggerRef}
        className="keypad-trigger"
        type="button"
        onClick={onOpenKeypad}
        aria-label="Open number keypad"
        aria-haspopup="dialog"
        aria-controls={keypadId}
      >
        {Array.from({ length: 6 }, (_, index) => (
          <span className="dot" aria-hidden="true" key={index} />
        ))}
      </button>
    </header>
  )
}
