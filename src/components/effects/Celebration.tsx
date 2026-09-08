import { useEffect, useRef, type CSSProperties } from 'react'

interface CelebrationProps {
  active: boolean
  durationMs?: number
  count?: number
  onComplete?: () => void
}

const COLORS = ['#8B0450', '#B85A89', '#E8A6C3', '#16a34a', '#f59e0b']

export function Celebration({ active, durationMs = 3500, count = 40, onComplete }: CelebrationProps) {
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])
  useEffect(() => {
    if (!active || !onCompleteRef.current) return
    const timer = window.setTimeout(() => onCompleteRef.current?.(), durationMs)
    return () => window.clearTimeout(timer)
  }, [active, durationMs])

  if (!active) return null
  return (
    <div className="celebration" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span
          className="celebration-piece confetti"
          style={{ left: `${(index * 37) % 100}vw`, background: COLORS[index % COLORS.length], animationDuration: `${1.8 + (index % 8) * 0.17}s`, '--celebration-drift': `${(index * 29) % 180 - 90}px`, '--drift': `${(index * 29) % 180 - 90}px` } as CSSProperties}
          key={index}
        />
      ))}
    </div>
  )
}
