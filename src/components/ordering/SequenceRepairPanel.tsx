import type { ReactNode } from 'react'

import type { ChoiceOptionConfig, SequenceValue } from '../../task-engine/schema'
import { ChoiceGroup } from '../answers/ChoiceGroup'
import { ActionButton } from '../task/ActionButton'
import { StatusTag } from '../task/StatusTag'

interface SequenceRepairPanelProps {
  title: string
  tag: string
  cue: ReactNode
  hint: ReactNode
  values: readonly (SequenceValue | null)[]
  activeIndex: number
  options: readonly ChoiceOptionConfig[]
  attempt: number
  feedback?: string
  model?: ReactNode
  modelVisible?: boolean
  onChoose: (value: string) => void
  onShowModel?: () => void
  onKeepTrying?: () => void
}

export function SequenceRepairPanel({ title, tag, cue, hint, values, activeIndex, options, attempt, feedback = '', model, modelVisible = false, onChoose, onShowModel, onKeepTrying }: SequenceRepairPanelProps) {
  return (
    <section className="retry sequence-repair-panel" data-stage="retry" data-position={activeIndex + 1} data-attempt={attempt}>
      <div className="retry-head"><strong>{title}</strong><StatusTag tone="warning">{tag}</StatusTag></div>
      <div className="bookcue">{cue}</div>
      <div className={`hint ${attempt > 1 ? 'deep' : ''}`}>{hint}</div>
      <div className="sequence-repair-panel__sequence">{values.map((value, index) => <span className={`${index === activeIndex ? 'active' : ''} ${index === 0 ? 'fixed' : ''}`.trim()} key={index}>{value ?? '—'}</span>)}</div>
      <ChoiceGroup ariaLabel={`${title} choices`} options={options} disabled={Boolean(feedback) || modelVisible} onChange={onChoose} />
      <div className={`micro ${feedback ? (feedback.includes('✓') ? 'ok' : 'bad') : ''}`} aria-live="polite">{feedback}</div>
      {modelVisible ? <div className="answerbox">{model}</div> : attempt >= 3 && model ? <div className="actions" data-final-actions><ActionButton variant="secondary" data-show-model onClick={onShowModel}>Show model</ActionButton><ActionButton data-keep onClick={onKeepTrying}>Try once more</ActionButton></div> : null}
    </section>
  )
}
