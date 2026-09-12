import type { Form2FillConfig, GradingItemResult } from '../dynamic-schema'

interface BlankFillRendererProps {
  config: Form2FillConfig
  answers: Record<string, string>
  onAnswerChange: (fieldId: string, value: string) => void
  results: Record<string, GradingItemResult> | null
  disabled?: boolean
}

export function BlankFillRenderer({
  config,
  answers,
  onAnswerChange,
  results,
  disabled = false,
}: BlankFillRendererProps) {
  return (
    <div className="blank-fill-renderer" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {config.note && (
        <p style={{ fontSize: '14px', color: 'var(--color-muted)', margin: '0 0 12px' }}>
          {config.note}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {(config.fields || config.items || []).map((field, idx) => {
          const fieldKey = String(field.id !== undefined && field.id !== null ? field.id : idx + 1)
          const result = results?.[fieldKey] || null

          return (
            <div
              key={fieldKey}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '12px',
                background: 'var(--color-surface, #f9fafb)',
                borderRadius: '8px',
                border: '1px solid var(--color-line, #e5e7eb)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label
                  htmlFor={`field-${fieldKey}`}
                  style={{ fontWeight: 700, fontSize: '14px' }}
                >
                  Câu {field.label || fieldKey}:
                </label>
                {result && (
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: result.correct ? 'var(--color-success, #10b981)' : 'var(--color-error, #ef4444)',
                    }}
                  >
                    {result.correct ? '✓ Đúng' : '✗ Chưa đúng'}
                  </span>
                )}
              </div>

              <input
                id={`field-${fieldKey}`}
                type="text"
                autoComplete="off"
                inputMode={field.inputMode}
                className="form-input"
                disabled={disabled}
                placeholder={field.placeholder || 'Nhập câu trả lời...'}
                value={answers[fieldKey] || ''}
                onChange={(e) => onAnswerChange(fieldKey, e.target.value)}
                style={{
                  borderColor:
                    !result
                      ? undefined
                      : result.correct
                      ? 'var(--color-success, #10b981)'
                      : 'var(--color-error, #ef4444)',
                }}
              />

              {result && !result.correct && result.hint && (
                <div
                  style={{
                    fontSize: '13px',
                    color: '#b45309',
                    background: '#fef3c7',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    marginTop: '2px',
                  }}
                >
                  💡 <strong>Gợi ý:</strong> {result.hint}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
