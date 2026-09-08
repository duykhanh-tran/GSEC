import type { ChecklistItemConfig } from '../../task-engine/schema'

interface ReadinessChecklistProps {
  items: readonly ChecklistItemConfig[]
  values: Readonly<Record<string, boolean>>
  ariaLabel?: string
  disabled?: boolean
  onChange: (id: string, checked: boolean) => void
}

export function ReadinessChecklist({ items, values, ariaLabel = 'Readiness checklist', disabled = false, onChange }: ReadinessChecklistProps) {
  return (
    <div className="readiness-checklist plan" role="group" aria-label={ariaLabel}>
      {items.map((item) => {
        const checked = Boolean(values[item.id])
        return <button className={`readiness-checklist__item plan-item ${checked ? 'checked' : ''}`.trim()} type="button" data-checklist-item={item.id} aria-pressed={checked} disabled={disabled} onClick={() => onChange(item.id, !checked)} key={item.id}><span className="readiness-checklist__check check" aria-hidden="true">{checked ? '✓' : ''}</span><span className="readiness-checklist__text plan-text"><strong>{item.title}</strong>{item.help ? <small>{item.help}</small> : null}</span></button>
      })}
    </div>
  )
}
