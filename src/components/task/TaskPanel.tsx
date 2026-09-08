import type { HTMLAttributes, ReactNode } from 'react'

interface TaskPanelProps extends HTMLAttributes<HTMLElement> {
  title: string
  subtitle: ReactNode
  variant?: 'card' | 'summary'
  children: ReactNode
}

export function TaskPanel({
  title,
  subtitle,
  variant = 'card',
  className = '',
  children,
  ...props
}: TaskPanelProps) {
  const baseClass = variant === 'summary' ? 'summary result-summary' : 'card task-card'
  const headClass = variant === 'summary' ? 'ch result-summary__head' : 'ch task-card__head'
  const bodyClass = variant === 'summary' ? 'cb result-summary__body' : 'cb task-card__body'
  return (
    <section className={`${baseClass} ${className}`.trim()} {...props}>
      <div className={headClass}>
        <h2>{title}</h2>
        <span>{subtitle}</span>
      </div>
      <div className={bodyClass}>{children}</div>
    </section>
  )
}
