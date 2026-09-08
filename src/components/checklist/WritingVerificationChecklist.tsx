import type { ReactNode } from 'react'

import type { VerificationItemConfig } from '../../task-engine/schema'
import { ActionButton } from '../task/ActionButton'

interface WritingVerificationChecklistProps {
  title?: ReactNode
  items: readonly VerificationItemConfig[]
  values: Readonly<Record<string, boolean>>
  words?: readonly string[]
  evidence: string
  evidencePlaceholder?: string
  note?: ReactNode
  submitLabel?: string
  error?: ReactNode
  onItemChange: (id: string, checked: boolean) => void
  onEvidenceChange: (value: string) => void
  onSubmit: () => void
}

export function WritingVerificationChecklist({ title = 'Book check • spelling & punctuation', items, values, words = [], evidence, evidencePlaceholder = 'Type one checked word', note, submitLabel = 'Save', error, onItemChange, onEvidenceChange, onSubmit }: WritingVerificationChecklistProps) {
  return (
    <div className="writing-verification" data-writing-verification>
      <strong>{title}</strong>
      <div className="writing-verification__items">
        {items.map((item) => <label key={item.id}><input type="checkbox" data-verification-item={item.id} checked={Boolean(values[item.id])} onChange={(event) => onItemChange(item.id, event.target.checked)} /> <span>{item.label}</span></label>)}
      </div>
      {words.length ? <div className="writing-verification__words">{words.map((word) => <span className="word" key={word}>{word}</span>)}</div> : null}
      <div className="writing-verification__input"><input type="text" value={evidence} placeholder={evidencePlaceholder} aria-label={evidencePlaceholder} onChange={(event) => onEvidenceChange(event.target.value)} /><ActionButton data-save onClick={onSubmit}>{submitLabel}</ActionButton></div>
      {error ? <div className="writing-verification__error" role="alert">{error}</div> : null}
      {note ? <div className="note">{note}</div> : null}
    </div>
  )
}
