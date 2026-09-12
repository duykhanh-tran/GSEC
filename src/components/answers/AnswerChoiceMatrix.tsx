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
    const isCompactPrompt = rows.every((r) => {
      if (typeof r.prompt === 'number') return true
      if (typeof r.prompt === 'string') {
        const s = r.prompt.trim()
        return s.length <= 8 || /^(câu\s*\d+|question\s*\d+|\d+)$/i.test(s)
      }
      return false
    })
    const isManyOptions = columns.length >= 5
    const optionCount = columns.length

    return (
      <div
        className={`answer-choice-matrix answer-choice-matrix--table matrix-wrap ${
          isCompactPrompt ? 'matrix-compact-prompt' : 'matrix-text-prompt'
        } ${isManyOptions ? 'matrix-many-options' : ''}`.trim()}
        data-answer-matrix
        data-columns={optionCount}
      >
        <table className="matrix" aria-label={ariaLabel}>
          <colgroup>
            <col
              className="matrix-col-prompt"
              style={{
                width: isCompactPrompt
                  ? optionCount >= 7
                    ? '40px'
                    : optionCount >= 5
                    ? '46px'
                    : '52px'
                  : undefined,
              }}
            />
            {columns.map((option) => (
              <col key={option.value} className="matrix-col-option" />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="matrix-prompt-header">
                <span className="sr-only">#</span>
              </th>
              {columns.map((option) => (
                <th scope="col" key={option.value} className="matrix-option-header">
                  {option.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = String(row.id)
              return (
                <tr data-question={id} key={id}>
                  <th scope="row" className="matrix-prompt-cell">
                    {row.prompt}
                  </th>
                  {row.options.map((option) => (
                    <td key={option.value} className="matrix-option-cell">
                      <button
                        type="button"
                        className={`cell ${values[id] === option.value ? 'sel' : ''}`.trim()}
                        data-answer-index={id}
                        data-answer-value={option.value}
                        aria-label={`Question ${id}: ${option.value}`}
                        aria-pressed={values[id] === option.value}
                        disabled={disabled || option.disabled}
                        onClick={() => onChange(id, option.value)}
                      >
                        <span className="choice-dot" aria-hidden="true" />
                      </button>
                    </td>
                  ))}
                </tr>
              )
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
