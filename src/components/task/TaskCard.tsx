import type { ReactNode } from 'react'

interface TaskCardProps {
  title: string
  subtitle?: string
  children: ReactNode
}

export function TaskCard({ title, subtitle, children }: TaskCardProps) {
  return (
    <section className="task-card">
      <header className="task-card__head">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      <div className="task-card__body">{children}</div>
    </section>
  )
}
