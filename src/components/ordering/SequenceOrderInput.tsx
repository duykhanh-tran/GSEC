import type { SequenceSlotConfig, SequenceValue } from '../../task-engine/schema'

interface SequenceOrderInputProps {
  slots: readonly SequenceSlotConfig[]
  choices: readonly SequenceValue[]
  selectedSlotId: string | number | null
  ariaLabel?: string
  onSelectSlot: (slotId: string | number) => void
  onPlace: (value: SequenceValue) => void
}

export function SequenceOrderInput({ slots, choices, selectedSlotId, ariaLabel = 'Sequence order', onSelectSlot, onPlace }: SequenceOrderInputProps) {
  const used = new Set(slots.map(({ value }) => value).filter((value): value is SequenceValue => value !== null))
  const selectedSlot = slots.find(({ id }) => id === selectedSlotId)

  return (
    <div className="sequence-order-input" data-sequence-order>
      <div className="sequence-order-input__slots" role="group" aria-label={ariaLabel}>
        {slots.map((slot) => <button className={`sequence-slot ${slot.fixed ? 'fixed' : ''} ${slot.id === selectedSlotId ? 'selected' : ''}`.trim()} type="button" data-slot={slot.id} aria-pressed={slot.id === selectedSlotId} disabled={slot.fixed} onClick={() => onSelectSlot(slot.id)} key={slot.id}><small>{slot.label}</small><strong>{slot.value ?? '—'}</strong></button>)}
      </div>
      <div className="sequence-order-input__bank" aria-label="Available choices">
        {choices.map((choice) => {
          const selectedValue = selectedSlot?.value === choice
          const disabled = used.has(choice) && !selectedValue
          return <button className={`sequence-choice ${used.has(choice) ? 'used' : ''}`.trim()} type="button" data-choice={choice} disabled={disabled || !selectedSlot || selectedSlot.fixed} onClick={() => onPlace(choice)} key={choice}>{choice}</button>
        })}
      </div>
    </div>
  )
}
