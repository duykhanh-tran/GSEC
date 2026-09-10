import { AnswerChoiceMatrix } from '../../components/answers/AnswerChoiceMatrix'
import type { Form1ChoiceConfig, GradingItemResult } from '../dynamic-schema'

interface ChoiceMatrixRendererProps {
  config: Form1ChoiceConfig
  answers: Record<string, string>
  onAnswerChange: (questionId: string, value: string) => void
  results: Record<string, GradingItemResult> | null
  disabled?: boolean
}

export function ChoiceMatrixRenderer({
  config,
  answers,
  onAnswerChange,
  results,
  disabled = false,
}: ChoiceMatrixRendererProps) {
  const rows = config.items.map((item) => {
    const id = String(item.id)
    const result = results?.[id] || null

    return {
      id,
      prompt: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700 }}>{item.label}</span>
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
          {item.cue && <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>{item.cue}</span>}
          {item.prompt && <span style={{ fontSize: '14px' }}>{item.prompt}</span>}
          {result && !result.correct && result.hint && (
            <div
              style={{
                fontSize: '13px',
                color: '#b45309',
                background: '#fef3c7',
                padding: '6px 10px',
                borderRadius: '6px',
                marginTop: '4px',
              }}
            >
              💡 <strong>Gợi ý:</strong> {result.hint}
            </div>
          )}
        </div>
      ),
      options: config.options.map((opt) => ({
        value: opt,
        label: opt,
      })),
    }
  })

  return (
    <div className="choice-matrix-renderer" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {config.note && (
        <p style={{ fontSize: '14px', color: 'var(--color-muted)', margin: '0 0 12px' }}>
          {config.note}
        </p>
      )}

      {config.passage && (
        <div
          style={{
            background: 'var(--color-surface, #f9fafb)',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid var(--color-line, #e5e7eb)',
            lineHeight: 1.6,
            fontSize: '14px',
            marginBottom: '16px',
          }}
        >
          {config.passage}
        </div>
      )}

      <AnswerChoiceMatrix
        layout="table"
        rows={rows}
        values={answers}
        disabled={disabled}
        onChange={onAnswerChange}
      />
    </div>
  )
}
