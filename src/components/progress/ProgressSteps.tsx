import type { ProgressStepConfig } from '../../task-engine/schema'

interface ProgressStepsProps {
  steps: readonly ProgressStepConfig[]
  ariaLabel?: string
  variant?: 'list' | 'segments'
}

export function ProgressSteps({ steps, ariaLabel = 'Task progress', variant = 'list' }: ProgressStepsProps) {
  return (
    <ol className={`progress-steps progress-steps--${variant}`} aria-label={ariaLabel}>
      {steps.map((step) => (
        <li className={`progress-step progress-step--${step.status}`} aria-current={step.status === 'active' ? 'step' : undefined} key={step.id}>
          <span aria-hidden="true">{step.status === 'complete' ? '✓' : ''}</span><span className="progress-step__label">{step.label}</span>
        </li>
      ))}
    </ol>
  )
}
