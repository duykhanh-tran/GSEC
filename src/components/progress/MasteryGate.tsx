import type { ReactNode } from 'react'

import { StatusTag } from '../task/StatusTag'

interface MasteryGateProps {
  mastered: boolean
  title?: string
  children?: ReactNode
}

export function MasteryGate({ mastered, title = mastered ? 'Mastery ✓' : 'Keep practising', children }: MasteryGateProps) {
  return <div className={`mastery-gate mastery-gate--${mastered ? 'passed' : 'pending'}`} data-mastery={mastered ? 'passed' : 'pending'}><StatusTag tone={mastered ? 'success' : 'warning'}>{title}</StatusTag>{children ? <div className="mastery-gate__detail">{children}</div> : null}</div>
}
