import type { ReactNode } from 'react'

interface ResultSummaryProps {
  title: string
  subtitle?: string
  children: ReactNode
}

export function ResultSummary({ title, subtitle, children }: ResultSummaryProps) {
  return (
    <section className="result-summary">
      <header className="result-summary__head">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      <div className="result-summary__body">{children}</div>
    </section>
  )
}
