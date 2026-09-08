import type { ReactNode } from 'react'

import { TutorAvatar } from './TutorAvatar'

interface ChatRowProps {
  role: 'tutor' | 'student'
  children: ReactNode
}

export function ChatRow({ role, children }: ChatRowProps) {
  const isStudent = role === 'student'

  return (
    <div
      className={isStudent ? 'row student chat-row chat-row--student' : 'row chat-row'}
      data-chat-role={role}
    >
      {isStudent ? null : <TutorAvatar />}
      {children}
    </div>
  )
}
