import type { ReactNode } from 'react'

interface FeedbackBoxProps {
  status: 'success' | 'error' | 'hint'
  children: ReactNode
}

export function FeedbackBox({ status, children }: FeedbackBoxProps) {
  return (
    <div
      className={`feedback-box feedback-box--${status}`}
      role={status === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  )
}
