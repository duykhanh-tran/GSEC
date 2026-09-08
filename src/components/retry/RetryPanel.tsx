import type { ReactNode } from 'react'

import type { RetryFieldConfig } from '../../task-engine/schema'
import { ActionButton } from '../task/ActionButton'
import { StatusTag } from '../task/StatusTag'

interface RetryPanelProps {
  title: string
  tag: string
  prompt: ReactNode
  hint: ReactNode
  rule?: ReactNode
  attempt: number
  question: string | number
  fields: readonly RetryFieldConfig[]
  feedback?: string
  onFieldChange: (fieldId: string | number, value: string) => void
  onCheck: () => void
}

export function RetryPanel({ title, tag, prompt, hint, rule, attempt, question, fields, feedback = '', onFieldChange, onCheck }: RetryPanelProps) {
  return (
    <section className="retry retry-panel" data-stage="retry" data-question={question} data-attempt={attempt}>
      <div className="retry-head"><strong>{title}</strong><StatusTag tone="warning">{tag}</StatusTag></div>
      <div className="sentence">{prompt}</div>
      <div className="hint">{hint}</div>
      {rule ? <div className="rule">{rule}</div> : null}
      <div className={`retry-fields ${fields.length > 1 ? 'double' : ''}`}>
        {fields.map((field, index) => (
          <input
            autoFocus={index === 0}
            className="retry-input"
            type="text"
            autoComplete="off"
            data-retry-part={field.id}
            placeholder={field.placeholder}
            value={field.value}
            onChange={(event) => onFieldChange(field.id, event.target.value)}
            key={field.id}
          />
        ))}
      </div>
      <ActionButton className="btn primary retry-check" data-retry-check onClick={onCheck}>Check again</ActionButton>
      <div className={`micro ${feedback === 'Correct ✓' ? 'ok' : feedback ? 'bad' : ''}`} aria-live="polite">{feedback}</div>
    </section>
  )
}
