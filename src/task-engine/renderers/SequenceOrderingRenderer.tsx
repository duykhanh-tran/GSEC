import { useState } from 'react'
import { SequenceOrderInput } from '../../components/ordering/SequenceOrderInput'
import type { Form5SequenceConfig } from '../dynamic-schema'

interface SequenceOrderingRendererProps {
  config: Form5SequenceConfig
  order: (number | null)[]
  onOrderChange: (newOrder: (number | null)[]) => void
  results: any | null
  disabled?: boolean
}

export function SequenceOrderingRenderer({
  config,
  order,
  onOrderChange,
  results,
  disabled = false,
}: SequenceOrderingRendererProps) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(1)

  const slots = Array.from({ length: config.total_slots }).map((_, idx) => ({
    id: idx,
    label: `Vị trí ${idx + 1}`,
    value: order[idx] ?? null,
    fixed: config.fixed_first !== undefined && idx === 0,
  }))

  const handlePlace = (value: string | number) => {
    if (typeof selectedSlot !== 'number' || typeof value !== 'number' || disabled) return
    const nextOrder = order.map((item, idx) => (idx === selectedSlot ? value : item))
    onOrderChange(nextOrder)

    // Tự động nhảy sang slot trống tiếp theo
    const nextEmpty = nextOrder.findIndex((item, idx) => idx > selectedSlot && item === null)
    if (nextEmpty !== -1) {
      setSelectedSlot(nextEmpty)
    }
  }

  const activeRepair = results?.active_repair

  return (
    <div className="sequence-ordering-renderer" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '14px', color: 'var(--color-muted)', marginBottom: '16px' }}>
          {config.intro}
        </p>

        <SequenceOrderInput
          slots={slots}
          choices={config.choices}
          selectedSlotId={selectedSlot}
          onSelectSlot={(id) => setSelectedSlot(Number(id))}
          onPlace={handlePlace}
        />
      </div>

      {results && results.active_repair && (
        <div
          style={{
            padding: '14px',
            background: '#fef3c7',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#92400e',
            marginTop: '8px',
          }}
        >
          <strong>💡 Gợi ý liên kết đoạn văn (Vị trí {activeRepair.position + 1}):</strong>
          <p style={{ margin: '6px 0 0' }}>{activeRepair.hint}</p>
        </div>
      )}
    </div>
  )
}
