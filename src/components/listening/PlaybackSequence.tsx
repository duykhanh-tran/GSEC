import { useEffect, useState } from 'react'

import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis'
import { useTaskTimers } from '../../hooks/useTaskTimers'
import { ActionButton } from '../task/ActionButton'

interface PlaybackSequenceProps {
  items: readonly string[]
  intervalMs?: number
  label?: string
  replayLabel?: string
  onComplete?: () => void
  showItems?: boolean
}

export function PlaybackSequence({ items, intervalMs = 1400, label = 'Play sequence', replayLabel = 'Play again', onComplete, showItems = true }: PlaybackSequenceProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [hasPlayed, setHasPlayed] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const speak = useSpeechSynthesis()
  const schedule = useTaskTimers()

  const play = () => {
    if (isPlaying || !items.length) return
    setHasPlayed(true)
    setIsPlaying(true)
    items.forEach((item, index) => {
      schedule(() => { setActiveIndex(index); speak(item) }, index * intervalMs)
    })
    schedule(() => { setActiveIndex(null); setIsPlaying(false); onComplete?.() }, items.length * intervalMs)
  }

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  return (
    <div className="playback-sequence" data-playback-sequence>
      {showItems ? <ol>
        {items.map((item, index) => <li className={activeIndex === index ? 'active' : ''} aria-current={activeIndex === index ? 'step' : undefined} key={`${item}-${index}`}>{item}</li>)}
      </ol> : null}
      <ActionButton data-play-sequence={!hasPlayed || undefined} data-play-again={hasPlayed || undefined} disabled={isPlaying || !items.length} onClick={play}>{hasPlayed ? replayLabel : label}</ActionButton>
    </div>
  )
}
