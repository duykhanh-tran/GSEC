import type { AnswerMatrixRowConfig } from '../../task-engine/schema'
import { ChoiceGroup } from './ChoiceGroup'

interface AnswerChoiceMatrixProps {
  rows: readonly AnswerMatrixRowConfig[]
  values: Readonly<Record<string, string | undefined>>
  layout?: 'cards' | 'table'
  ariaLabel?: string
  disabled?: boolean
  onChange: (rowId: string, value: string) => void
}

export function AnswerChoiceMatrix({ rows, values, layout = 'cards', ariaLabel = 'Answer choices', disabled = false, onChange }: AnswerChoiceMatrixProps) {
  if (layout === 'table') {
    const columns = rows[0]?.options ?? []
    return (
      <div className="answer-choice-matrix answer-choice-matrix--table matrix-wrap" data-answer-matrix>
        <table className="matrix" aria-label={ariaLabel}>
          <thead><tr><th scope="col"></th>{columns.map((option) => <th scope="col" key={option.value}>{option.label}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => {
              const id = String(row.id)
              return <tr data-question={id} key={id}><th scope="row">{row.prompt}</th>{row.options.map((option) => <td key={option.value}><button type="button" className={`cell ${values[id] === option.value ? 'sel' : ''}`.trim()} data-answer-index={id} data-answer-value={option.value} aria-label={`Question ${id}: ${option.value}`} aria-pressed={values[id] === option.value} disabled={disabled || option.disabled} onClick={() => onChange(id, option.value)}><span className="choice-dot" aria-hidden="true" /></button></td>)}</tr>
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="answer-choice-matrix matrix" data-answer-matrix>
      {rows.map((row) => {
        const id = String(row.id)
        return (
          <div className="answer-choice-matrix__row" data-question={id} key={id}>
            <div className="answer-choice-matrix__prompt">{row.prompt}</div>
            <ChoiceGroup
              ariaLabel={`Question ${id}`}
              options={row.options}
              value={values[id]}
              disabled={disabled}
              onChange={(value) => onChange(id, value)}
            />
          </div>
        )
      })}
    </div>
  )
}
