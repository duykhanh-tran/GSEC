import type { HTMLAttributes } from 'react'

import type { ChoiceOptionConfig } from '../../task-engine/schema'

interface ChoiceGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  ariaLabel: string
  options: readonly ChoiceOptionConfig[]
  value?: string
  wrongValue?: string
  disabled?: boolean
  optionDataAttribute?: string
  onChange: (value: string) => void
}

export function ChoiceGroup({ ariaLabel, options, value, wrongValue, disabled = false, optionDataAttribute, className = '', onChange, ...props }: ChoiceGroupProps) {
  return (
    <div className={`choice-group options ${className}`.trim()} role="radiogroup" aria-label={ariaLabel} {...props}>
      {options.map((option) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={`choice-group__option opt ${value === option.value ? 'sel' : ''} ${wrongValue === option.value ? 'wrong' : ''}`.trim()}
          data-option={option.value}
          {...(optionDataAttribute ? { [`data-${optionDataAttribute}`]: option.value } : {})}
          disabled={disabled || option.disabled}
          onClick={() => onChange(option.value)}
          key={option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
