import type { ReactNode } from 'react'

interface StudentBubbleProps {
  children: ReactNode
}

export function StudentBubble({ children }: StudentBubbleProps) {
  return <div className="bubble chat-bubble chat-bubble--student">{children}</div>
}
