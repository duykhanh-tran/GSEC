import type { DraftVersionConfig } from '../../task-engine/schema'

interface DraftComparisonProps {
  versions: readonly DraftVersionConfig[]
  ariaLabel?: string
}

export function DraftComparison({ versions, ariaLabel = 'Draft comparison' }: DraftComparisonProps) {
  return <div className="draft-comparison compare" aria-label={ariaLabel}>{versions.map((version) => <article className="draft-comparison__version comparebox" data-draft-version={version.id} key={version.id}><strong>{version.label}</strong><p>{version.text}</p></article>)}</div>
}
