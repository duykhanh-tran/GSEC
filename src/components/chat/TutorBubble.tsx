import type { ReactNode } from 'react'

interface TutorBubbleProps {
  children: ReactNode
}

export function TutorBubble({ children }: TutorBubbleProps) {
  return <div className="bubble chat-bubble chat-bubble--tutor">{children}</div>
}
