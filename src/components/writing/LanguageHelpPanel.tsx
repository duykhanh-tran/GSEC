import type { ReactNode } from 'react'

interface LanguageHelpPanelProps {
  title?: ReactNode
  phrases: readonly string[]
}

export function LanguageHelpPanel({ title = 'Language Help', phrases }: LanguageHelpPanelProps) {
  return <section className="language-help"><h3>{title}</h3><div className="language-help__phrases">{phrases.map((phrase) => <span className="language-help__phrase" key={phrase}>{phrase}</span>)}</div></section>
}
