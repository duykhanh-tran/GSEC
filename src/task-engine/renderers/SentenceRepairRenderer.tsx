import type { Form4SentenceRepairConfig, GradingItemResult } from '../dynamic-schema'

interface SentenceRepairRendererProps {
  config: Form4SentenceRepairConfig
  answers: Record<string, string>
  onAnswerChange: (itemId: string, value: string) => void
  results: Record<string, GradingItemResult> | null
  disabled?: boolean
}

export function SentenceRepairRenderer({
  config,
  answers,
  onAnswerChange,
  results,
  disabled = false,
}: SentenceRepairRendererProps) {
  return (
    <div className="sentence-repair-renderer" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {config.items.map((item) => {
          const result = results?.[item.id] || null

          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '14px',
                background: 'var(--color-surface, #f9fafb)',
                borderRadius: '8px',
                border: '1px solid var(--color-line, #e5e7eb)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-primary)' }}>
                  Câu {item.id} {item.type ? `(${item.type})` : ''}:
                </span>
                {result && (
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: result.correct ? 'var(--color-success, #10b981)' : 'var(--color-error, #ef4444)',
                    }}
                  >
                    {result.correct ? '✓ Đã sửa đúng' : '✗ Chưa chính xác'}
                  </span>
                )}
              </div>

              <div
                style={{
                  padding: '10px 12px',
                  background: '#fef2f2',
                  border: '1px solid #fee2e2',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#991b1b',
                }}
              >
                <strong>Câu gốc:</strong> <em>“{item.first}”</em>
              </div>

              <input
                type="text"
                className="form-input"
                disabled={disabled}
                placeholder="Nhập lại câu hoàn chỉnh đã sửa..."
                value={answers[item.id] || ''}
                onChange={(e) => onAnswerChange(item.id, e.target.value)}
                style={{
                  borderColor:
                    result === null
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
                  }}
                >
                  💡 <strong>Gợi ý ngữ pháp:</strong> {result.hint}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
