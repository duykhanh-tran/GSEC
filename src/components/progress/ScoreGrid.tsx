import type { ScoreItemConfig } from '../../task-engine/schema'

interface ScoreGridProps {
  items: readonly ScoreItemConfig[]
  ariaLabel?: string
}

export function ScoreGrid({ items, ariaLabel = 'Scores' }: ScoreGridProps) {
  return (
    <div className="score-grid scoregrid" aria-label={ariaLabel}>
      {items.map((item) => <div className={`score score--${item.tone ?? 'default'}`} key={item.id}><strong>{item.value}</strong><span>{item.label}</span></div>)}
    </div>
  )
}
